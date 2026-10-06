// Actual-image tests, not a replacement proxy. No provider/database access.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import dgram from "node:dgram";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const image = "projectx-dev-gateway:local";
const containerPort = 10000;
const hostAlias = "host.docker.internal"; // Docker Desktop local tests only.
const canonical = "gateway.test.invalid";
const origin = `https://${canonical}`;
const canary = "SYNTHETIC_GATEWAY_CANARY_71d909";
const cookie = `__Host-projectx-session=${canary}; Secure; HttpOnly; SameSite=Lax; Path=/`;
const removed =
  "__Host-projectx-login=; Max-Age=0; Secure; HttpOnly; SameSite=Lax; Path=/";
const read = (p) => readFile(path.join(root, p), "utf8");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const digest = (body) => createHash("sha256").update(body).digest("hex");
// Never use a remote Docker context/daemon for a loopback-only proof.
const localDaemon =
  !process.env.DOCKER_HOST || /^(unix:|npipe:)/.test(process.env.DOCKER_HOST);
const dockerInfo = localDaemon
  ? spawnSync("docker", ["info", "--format", "{{.OSType}}"], {
      encoding: "utf8",
      timeout: 10000,
    })
  : null;
const dockerContext = localDaemon
  ? spawnSync(
      "docker",
      ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
      { encoding: "utf8", timeout: 10000 },
    )
  : null;
const dockerReady =
  dockerInfo?.status === 0 &&
  dockerInfo.stdout.trim() === "linux" &&
  /^(unix:|npipe:)/.test(dockerContext?.stdout.trim() ?? "");
const blocked =
  "BLOCKED BY TOOLING: local Linux Docker Desktop bridge/host-alias support required; do not install or substitute a Node proxy";
if (!dockerReady) {
  console.error(blocked);
  process.exitCode = 2;
}
const docker = (args, timeout = 10000) => {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(
    result.status,
    0,
    `Docker operation failed: ${args[0]} (values/logs deliberately omitted)`,
  );
  return result.stdout;
};
const containers = new Set();
const records = [];
const sockets = new Set();
let upstream;
let gateway;
let apiPort;
let gatewayPort;
let realApp;
let mainProcess;

async function port() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const selected = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return selected;
}
function request(target = "/", options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    port: selectedPort = gatewayPort,
    timeoutMs = 75000,
  } = options;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: selectedPort,
        path: target,
        method,
        headers: { Host: canonical, ...headers },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            rawHeaders: res.rawHeaders,
            body: Buffer.concat(chunks).toString(),
          }),
        );
      },
    );
    const deadline = setTimeout(
      () => req.destroy(new Error("Local request deadline")),
      timeoutMs,
    );
    req.on("close", () => clearTimeout(deadline));
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}
function rawRequest(firstLine, headers) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(gatewayPort, "127.0.0.1", () => {
      socket.write(
        `${firstLine}\r\n${headers.join("\r\n")}\r\nConnection: close\r\n\r\n`,
      );
    });
    let response = "";
    socket.setTimeout(5000, () =>
      socket.destroy(new Error("Raw request timeout")),
    );
    socket.on("data", (chunk) => {
      response += chunk;
    });
    socket.on("error", reject);
    socket.on("end", () =>
      resolve({
        status: Number(response.match(/^HTTP\/1\.[01] ([0-9]+)/)?.[1]),
        response,
      }),
    );
  });
}
async function waitForPort(selectedPort, expectedStatus = 200) {
  const deadline = Date.now() + 10000;
  let lastResult = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await request("/health", {
        port: selectedPort,
        timeoutMs: Math.min(1000, deadline - Date.now()),
      });
      lastResult = `HTTP ${response.status}`;
      if (expectedStatus === null || response.status === expectedStatus) return;
    } catch (error) {
      lastResult = error.code ?? error.message;
    }
    await sleep(Math.min(100, Math.max(0, deadline - Date.now())));
  }
  assert.fail(
    `Local readiness failed within 10s on 127.0.0.1:${selectedPort}: ${lastResult}`,
  );
}
function publishedPort(name) {
  const mappings = JSON.parse(
    docker(["inspect", "--format", "{{json .NetworkSettings.Ports}}", name]),
  )[`${containerPort}/tcp`];
  assert.equal(mappings?.length, 1);
  assert.equal(mappings[0].HostIp, "127.0.0.1");
  const selectedPort = Number(mappings[0].HostPort);
  assert(Number.isInteger(selectedPort) && selectedPort > 0);
  return selectedPort;
}
function runContainer(env = {}, args = []) {
  const name = `projectx-gw-test-${randomUUID()}`;
  containers.add(name);
  docker([
    "run",
    "-d",
    "--name",
    name,
    "--network",
    "bridge",
    "--publish",
    `127.0.0.1::${containerPort}`,
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=32m",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "-e",
    `GATEWAY_CANONICAL_HOST=${canonical}`,
    "-e",
    `GATEWAY_API_HOSTPORT=${hostAlias}:${apiPort}`,
    "-e",
    `PORT=${containerPort}`,
    "-e",
    "GATEWAY_LISTEN_ADDRESS=0.0.0.0",
    ...Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
    ...args,
    image,
  ]);
  return name;
}
function stopContainer(name) {
  docker(["stop", "--time", "5", name], 10000);
  docker(["rm", name]);
  containers.delete(name);
}
function mock(req, res) {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const record = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      hash: digest(body),
      length: body.length,
    };
    records.push(record);
    const url = new URL(req.url, origin);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("CDN-Cache-Control", "public, max-age=3600");
    if (url.pathname === "/health") {
      res.end('{"status":"ok"}');
      return;
    }
    if (url.pathname.endsWith("/disconnect")) {
      req.socket.destroy();
      return;
    }
    if (url.pathname.endsWith("/slow")) return; // nginx's real 60s read bound.
    if (url.pathname.endsWith("/cookie-rotation")) {
      res.setHeader("Set-Cookie", [removed, cookie]);
      res.setHeader("Location", `${origin}/`);
      res.statusCode = 302;
    }
    if (url.pathname.endsWith("/logout"))
      res.setHeader("Set-Cookie", cookie.replace(`${canary};`, "; Max-Age=0;"));
    if (url.pathname.endsWith("/callback")) {
      if (url.searchParams.getAll("code").length > 1) res.statusCode = 400;
      else {
        res.setHeader("Set-Cookie", [removed, cookie]);
        res.statusCode = 302;
        res.setHeader("Location", `${origin}/`);
      }
    }
    const status = url.pathname.match(/\/status\/([0-9]+)$/);
    if (status) res.statusCode = Number(status[1]);
    if (res.statusCode === 302)
      res.setHeader("Location", `${origin}/?next=synthetic`);
    if (url.pathname.endsWith("/response-header"))
      res.setHeader(
        "X-Bounded-Fixture",
        "x".repeat(Number(url.searchParams.get("size"))),
      );
    if (/^\/api(\/v9\/|$)/.test(url.pathname)) res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ...record, marker: "MOCK_API_NOT_SPA" }));
  });
}

// Synthetic DNS on Windows loopback, reached through Docker Desktop's host alias.
// Rotate the A record host -> unavailable container loopback -> host, proving
// actual nginx refresh/recovery without requiring two Windows loopback aliases.
async function dnsRefreshProof() {
  const dns = dgram.createSocket("udp4");
  const hostname = "api.gateway.test.invalid";
  const hostAddress = docker(["exec", gateway, "getent", "hosts", hostAlias])
    .trim()
    .split(/\s+/)[0];
  assert.equal(net.isIP(hostAddress), 4);
  const reachableAddress = hostAddress.split(".").map(Number);
  let address = reachableAddress;
  dns.on("message", (packet, peer) => {
    if (packet.length < 17 || packet.readUInt16BE(4) !== 1) return;
    let offset = 12;
    const labels = [];
    while (
      offset < packet.length &&
      packet[offset] > 0 &&
      packet[offset] < 64
    ) {
      const size = packet[offset++];
      labels.push(packet.subarray(offset, offset + size).toString("ascii"));
      offset += size;
    }
    if (packet[offset] !== 0 || offset + 5 > packet.length) return;
    const questionEnd = offset + 5;
    const isA =
      labels.join(".") === hostname && packet.readUInt16BE(offset + 1) === 1;
    const header = Buffer.alloc(12);
    packet.copy(header, 0, 0, 2);
    header.writeUInt16BE(isA ? 0x8180 : 0x8183, 2);
    header.writeUInt16BE(1, 4);
    header.writeUInt16BE(isA ? 1 : 0, 6);
    const answer = isA
      ? Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 1, 0, 4, ...address])
      : Buffer.alloc(0);
    dns.send(
      Buffer.concat([header, packet.subarray(12, questionEnd), answer]),
      peer.port,
      peer.address,
    );
  });
  await new Promise((resolve) => dns.bind(0, "127.0.0.1", resolve));
  const folder = await mkdtemp(path.join(os.tmpdir(), "projectx-gw-dns-"));
  const resolverFile = path.join(folder, "resolv.conf");
  const backendPort = await port();
  const first = http.createServer((_req, res) => {
    res.setHeader("X-DNS-Backend", "one");
    res.end("one");
  });
  let container;
  try {
    await writeFile(resolverFile, `nameserver ${hostAddress}\n`, {
      mode: 0o444,
    });
    await new Promise((resolve) =>
      first.listen(backendPort, "127.0.0.1", resolve),
    );
    container = runContainer(
      {
        GATEWAY_API_HOSTPORT: `${hostname}:${backendPort}`,
        GATEWAY_DNS_PORT: String(dns.address().port),
      },
      [
        "--mount",
        `type=bind,source=${resolverFile},target=/etc/resolv.conf,readonly`,
      ],
    );
    const selectedPort = publishedPort(container);
    await waitForPort(selectedPort);
    let seen;
    for (let i = 0; i < 100; i++) {
      seen = await request("/api/v1/dns", { port: selectedPort });
      if (seen.headers["x-dns-backend"] === "one") break;
      await sleep(100);
    }
    assert.equal(seen.headers["x-dns-backend"], "one");
    address = [127, 0, 0, 2];
    for (let i = 0; i < 160; i++) {
      seen = await request("/api/v1/dns", { port: selectedPort });
      if (seen.status === 502) break;
      await sleep(100);
    }
    assert.equal(seen.status, 502);
    address = reachableAddress;
    for (let i = 0; i < 160; i++) {
      seen = await request("/api/v1/dns", { port: selectedPort });
      if (seen.headers["x-dns-backend"] === "one") break;
      await sleep(100);
    }
    assert.equal(seen.headers["x-dns-backend"], "one");
    assert.equal(seen.status, 200); // actual nginx, no restart/public fallback.
  } finally {
    if (container) stopContainer(container);
    first.closeAllConnections();
    await new Promise((resolve) => first.close(resolve));
    await new Promise((resolve) => dns.close(resolve));
    const absolute = await realpath(folder),
      parent = await realpath(os.tmpdir());
    assert.equal(path.dirname(absolute), parent);
    assert(path.basename(absolute).startsWith("projectx-gw-dns-"));
    await rm(absolute, { recursive: true, force: true });
  }
}

// Actual Docker context filtering, using only disposable synthetic fixtures.
// Reuses the already-built image; no pulls, provider, credentials or network.
async function buildContextProof() {
  const folder = await mkdtemp(path.join(os.tmpdir(), "projectx-gw-context-"));
  const probe = `projectx-gw-context-${randomUUID()}:local`;
  const included = [
    "package.json",
    "apps/web/src/context-proof.js",
    "packages/contracts/routes.json",
  ];
  const excluded = [
    ".env",
    ".env.local",
    ".git/context-proof",
    "local-database/data/context-proof",
    "apps/web/src/.env",
    "apps/web/src/test-secret.txt",
    "apps/web/src/context-proof.test.js",
    "packages/contracts/src/credential.txt",
    "apps/web/dist/context-proof.js",
  ];
  try {
    await writeFile(
      path.join(folder, ".dockerignore"),
      await read(".dockerignore"),
    );
    await writeFile(
      path.join(folder, "Dockerfile"),
      `FROM ${image}\nCOPY --chown=101:101 . /context-proof/\n`,
    );
    for (const fixture of [...included, ...excluded]) {
      const target = path.join(folder, fixture);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(
        target,
        included.includes(fixture) ? "PUBLIC_FIXTURE" : canary,
      );
    }
    docker(
      ["build", "--network", "none", "--pull=false", "-t", probe, folder],
      60000,
    );
    const output = docker([
      "run",
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--entrypoint",
      "sh",
      probe,
      "-c",
      `test -f /context-proof/package.json && test -f /context-proof/apps/web/src/context-proof.js && test -f /context-proof/packages/contracts/routes.json && ! grep -R -q ${canary} /context-proof`,
    ]);
    assert.equal(output, "");
  } finally {
    // Exact disposable image/directory only; never prune shared Docker state.
    spawnSync("docker", ["image", "rm", probe], {
      timeout: 10000,
      stdio: "ignore",
    });
    const absolute = await realpath(folder),
      parent = await realpath(os.tmpdir());
    assert.equal(path.dirname(absolute), parent);
    assert(path.basename(absolute).startsWith("projectx-gw-context-"));
    await rm(absolute, { recursive: true, force: true });
  }
}
before(async () => {
  if (!dockerReady) return;
  docker(["image", "inspect", image]); // Build explicitly first; never implicit download/install.
  apiPort = await port();
  upstream = http.createServer(mock);
  upstream.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve) =>
    upstream.listen(apiPort, "127.0.0.1", resolve),
  );
  gateway = runContainer();
  gatewayPort = publishedPort(gateway);
  await waitForPort(gatewayPort);
});
after(async () => {
  if (realApp) await realApp.close();
  if (mainProcess && mainProcess.exitCode === null) {
    mainProcess.kill("SIGTERM");
    await new Promise((resolve) => mainProcess.once("exit", resolve));
  }
  for (const socket of sockets) socket.destroy();
  if (upstream) await new Promise((resolve) => upstream.close(resolve));
  for (const name of containers) {
    // Exact names created by this harness only, even after failed startup/assertion.
    spawnSync("docker", ["rm", "-f", name], {
      timeout: 10000,
      stdio: "ignore",
    });
  }
});
let gatewayFailed = false;
const gw = (id, name, fn, timeout = 15000) =>
  test(`${id} ${name}`, {
    skip: dockerReady ? false : blocked,
    timeout,
  }, async (t) => {
    if (gatewayFailed) return t.skip("Stopped after prior GW failure");
    try {
      await fn();
    } catch (error) {
      gatewayFailed = true;
      throw error;
    }
  });

test("Focused bridge reachability", {
  skip: dockerReady ? false : blocked,
}, async () => {
  const state = JSON.parse(docker(["inspect", gateway]))[0];
  assert.equal(state.State.Running, true);
  assert.equal(state.HostConfig.NetworkMode, "bridge");
  assert.equal(state.HostConfig.ReadonlyRootfs, true);
  assert.equal(
    state.HostConfig.Tmpfs["/tmp"],
    "/tmp:rw,noexec,nosuid,size=32m".slice(5),
  );
  assert.equal(publishedPort(gateway), gatewayPort);
  const mapping = docker(["port", gateway, `${containerPort}/tcp`]).trim();
  assert.equal(mapping, `127.0.0.1:${gatewayPort}`);
  assert.equal((await request("/")).status, 200);
  for (const host of [`127.0.0.1:${gatewayPort}`, "foreign.invalid"])
    assert.equal((await request("/", { headers: { Host: host } })).status, 403);
  const before = records.length;
  const health = await request("/health");
  assert.equal(health.status, 200);
  assert.equal(JSON.parse(health.body).status, "ok");
  assert.equal(records.length, before + 1);
  assert.equal(records.at(-1).url, "/health");
  assert.equal(records.at(-1).headers.host, canonical);
  console.log(
    `Focused PASS: RUNNING; ${mapping} -> ${containerPort}; Windows mock 127.0.0.1:${apiPort} via ${hostAlias}; canonical/default/foreign=200/403/403; upstream health=200`,
  );
});

test("Static implementation audit (NOT nginx/runtime proof)", async () => {
  const [config, start, dockerfile, ignore, blueprint] = await Promise.all([
    read("deploy/gateway/nginx.conf.template"),
    read("deploy/gateway/start.sh"),
    read("deploy/gateway/Dockerfile"),
    read(".dockerignore"),
    read("render.yaml"),
  ]);
  assert.equal((dockerfile.match(/FROM /g) ?? []).length, 2);
  assert.equal((dockerfile.match(/@sha256:[a-f0-9]{64}/g) ?? []).length, 2);
  assert(!/FROM .*:latest|COPY\s+\.\s|\bARG\b\s+[A-Z_]+/.test(dockerfile));
  assert(
    dockerfile.includes("pnpm@11.25.0") && dockerfile.includes("node:24.19.0"),
  );
  for (const p of [
    "**/.env",
    "**/.env.*",
    "**/.git/**",
    "**/*secret*",
    "**/*.key",
  ])
    assert(ignore.includes(p));
  for (const required of [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
    "apps/web/package.json",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
    "packages/contracts/package.json",
    "packages/contracts/routes.json",
  ]) {
    assert(ignore.split(/\r?\n/).includes(`!${required}`));
    assert(existsSync(path.join(root, required)));
  }
  for (const directive of [
    "proxy_next_upstream off",
    "proxy_redirect off",
    "proxy_cache off",
    "proxy_request_buffering off",
    "proxy_buffering off",
    "client_max_body_size 1m",
    "proxy_read_timeout 60s",
    "server @@API_HOSTPORT@@ resolve",
  ])
    assert(config.includes(directive));
  assert(config.includes('proxy_set_header X-Forwarded-Host ""'));
  assert(
    !/proxy_cookie_|error_page|proxy_set_header (Origin|Referer|X-ProjectX-CSRF)/.test(
      config,
    ),
  );
  assert(
    start.includes("nginx -t") &&
      start.includes("exec nginx") &&
      !/\beval\b|envsubst/.test(start.replace(/^#.*$/gm, "")),
  );
  assert.equal((blueprint.match(/autoDeployTrigger: "off"/g) ?? []).length, 2);
  assert(
    blueprint.includes("type: pserv") &&
      blueprint.includes("property: hostport"),
  );
  assert(
    !/^databases:|^\s+(preDeployCommand|initialDeployHook|scaling|disk):/m.test(
      blueprint,
    ),
  );
});

const shell =
  process.platform === "win32"
    ? "C:/Program Files/Git/usr/bin/sh.exe"
    : "/bin/sh";
test("Pre-nginx input rejection (NOT nginx/runtime proof)", {
  skip: !existsSync(shell),
}, () => {
  for (const bad of [
    { GATEWAY_CANONICAL_HOST: "" },
    { GATEWAY_CANONICAL_HOST: `evil.invalid;${canary}` },
    { GATEWAY_CANONICAL_HOST: "a..invalid" },
    { GATEWAY_CANONICAL_HOST: "https://gateway.test.invalid" },
    { GATEWAY_API_HOSTPORT: "" },
    { GATEWAY_API_HOSTPORT: "http://127.0.0.1:3001" },
    { GATEWAY_API_HOSTPORT: `127.0.0.1:80;${canary}` },
    { GATEWAY_API_HOSTPORT: "127.0.0.1:65536" },
    { PORT: "80" },
    { AUTH0_CLIENT_SECRET: canary },
    { DATABASE_URL: canary },
    { STAFF_RUNTIME_DATABASE_URL: canary },
  ]) {
    const r = spawnSync(shell, [path.join(root, "deploy/gateway/start.sh")], {
      env: {
        PATH: "/usr/bin:/bin",
        SystemRoot: process.env.SystemRoot,
        GATEWAY_CANONICAL_HOST: canonical,
        GATEWAY_API_HOSTPORT: "127.0.0.1:3001",
        PORT: "10000",
        ...bad,
      },
      encoding: "utf8",
      timeout: 3000,
    });
    assert.equal(r.status, 1);
    assert.equal(r.stdout, "");
    assert.equal(r.stderr.trim(), "Gateway configuration rejected");
    assert(!r.stderr.includes(canary));
  }
});

gw("GW-01", "startup/syntax/static/health/asset failures", async () => {
  docker([
    "exec",
    gateway,
    "nginx",
    "-t",
    "-c",
    "/tmp/projectx-gateway/nginx.conf",
  ]);
  for (const target of ["/", "/people/accounts", "/nested/web/route"]) {
    const response = await request(target);
    assert.equal(response.status, 200);
    assert.match(response.body, /<html/i);
  }
  const index = await request("/");
  const asset = index.body.match(/(?:src|href)="(\/assets\/[^"?]+)"/);
  assert(asset, "Existing web build must expose a real asset");
  const loaded = await request(asset[1]);
  assert.equal(loaded.status, 200);
  assert(loaded.body.length > 0 && !/<html/i.test(loaded.body));
  assert.match(loaded.headers["cache-control"], /immutable/);
  const health = await request("/health", {
    headers: { Host: "platform-health.invalid" },
  });
  assert.equal(health.status, 200);
  assert.equal(JSON.parse(health.body).status, "ok");
  for (const target of ["/assets/missing.js", "/missing.css"])
    assert.equal((await request(target)).status, 404);
  assert.equal(
    (await request("/nested/web/route", { method: "POST", body: "synthetic" }))
      .status,
    403,
  );
});
gw("GW-02", "all methods/body hash/raw query encoding", async () => {
  const target = "/api/v1/echo?x=a%2Fb&x=%2B+%20&empty=";
  for (const method of [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ]) {
    const body = method === "HEAD" ? undefined : Buffer.from([0, 1, 2, 255]);
    const response = await request(target, {
      method,
      body,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": body?.length ?? 0,
      },
    });
    assert.equal(response.status, 200);
    const seen = records.at(-1);
    assert.equal(seen.method, method);
    assert.equal(seen.url, target);
    assert.equal(seen.hash, digest(body ?? Buffer.alloc(0)));
    if (method === "HEAD") assert.equal(response.body, "");
  }
});
gw("GW-03", "request headers unchanged/no invented authority", async () => {
  const headers = {
    "Content-Type": "application/json",
    "X-ProjectX-CSRF": canary,
    "X-ProjectX-Context-Version": "7",
    Cookie: `synthetic=${canary}`,
    Origin: "https://foreign.invalid",
    Referer: "https://foreign.invalid/form",
    Authorization: `Synthetic ${canary}`,
  };
  const response = await request("/api/v1/echo", {
    method: "POST",
    body: "{}",
    headers,
  });
  assert.equal(response.status, 200);
  for (const [key, value] of Object.entries(headers))
    assert.equal(records.at(-1).headers[key.toLowerCase()], value);
  for (const key of [
    "x-user-id",
    "x-organization-id",
    "x-venue-id",
    "x-permissions",
  ])
    assert.equal(records.at(-1).headers[key], undefined);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
});
gw("GW-04", "Host/raw authority/forwarding spoof rejects", async () => {
  for (const host of [
    "foreign.invalid",
    `${canonical}:443`,
    `${canonical}.`,
    "",
  ])
    assert.equal(
      (
        await request("/api/v1/echo", {
          headers: { Host: host, "X-Forwarded-Host": canonical },
        })
      ).status,
      403,
    );
  assert.equal((await rawRequest("GET /api/v1/echo HTTP/1.0", [])).status, 403);
  assert.equal(
    (
      await rawRequest("GET /api/v1/echo HTTP/1.1", [
        `Host: ${canonical}`,
        "Host: foreign.invalid",
      ])
    ).status,
    400,
  );
  assert.equal(
    (
      await rawRequest(`GET https://${canonical}/api/v1/echo HTTP/1.1`, [
        `Host: ${canonical}`,
      ])
    ).status,
    400,
  );
  const headers = {
    "X-Forwarded-Host": "foreign.invalid",
    Forwarded: "host=foreign.invalid;proto=http",
    "X-Forwarded-Proto": "http",
    "X-Forwarded-For": "198.51.100.2",
    "X-Real-IP": "198.51.100.3",
    "X-Forwarded-Port": "80",
    "X-Original-Host": "foreign.invalid",
  };
  assert.equal((await request("/api/v1/echo", { headers })).status, 200);
  const seen = records.at(-1).headers;
  for (const key of Object.keys(headers))
    if (key !== "X-Forwarded-Proto")
      assert.equal(seen[key.toLowerCase()], undefined);
  assert.equal(seen.host, canonical);
  assert.equal(seen["x-forwarded-proto"], "https");
  // HTTP/2 terminates at Render, not this internal HTTP/1.1 listener: live gate.
});
gw("GW-05", "separate rotation/logout cookies preserved", async () => {
  const response = await request("/api/v1/cookie-rotation");
  assert.deepEqual(response.headers["set-cookie"], [removed, cookie]);
  assert.equal(
    response.rawHeaders.filter((h) => h.toLowerCase() === "set-cookie").length,
    2,
  );
  assert(!response.headers["set-cookie"].some((h) => /domain=/i.test(h)));
  const logout = await request("/api/v1/staff-auth/logout", { method: "POST" });
  assert.match(logout.headers["set-cookie"][0], /Max-Age=0/);
});
gw("GW-06", "statuses/redirect/no-store/API precedence", async () => {
  for (const status of [204, 302, 400, 401, 403, 404, 409, 500]) {
    const response = await request(`/api/v1/status/${status}`);
    assert.equal(response.status, status);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.headers.pragma, "no-cache");
    assert.equal(response.headers["cdn-cache-control"], "no-store");
    if (status === 302)
      assert.equal(response.headers.location, `${origin}/?next=synthetic`);
    assert(!/<html/i.test(response.body));
  }
  for (const target of ["/api", "/api/v9/not-found", "/api/v9/index.html"]) {
    const r = await request(target);
    assert.equal(r.status, 404);
    assert(!/<html/i.test(r.body));
  }
  const first = await request("/api/v1/echo?unique=one"),
    second = await request("/api/v1/echo?unique=two");
  assert.notEqual(first.body, second.body);
});
gw("GW-07", "callback canaries reach only upstream/logs safe", async () => {
  const target = `/api/v1/staff-auth/callback?code=${canary}%2B&state=${canary}`;
  assert.equal(
    (
      await request(target, {
        headers: { Cookie: canary, "X-ProjectX-CSRF": canary },
      })
    ).status,
    302,
  );
  assert.equal(records.at(-1).url, target);
  assert.equal((await request(`${target}&code=duplicate`)).status, 400);
  const logs = docker(["logs", gateway]);
  assert(!logs.includes(canary));
  assert(!logs.includes("callback?"));
  const files = docker([
    "exec",
    gateway,
    "sh",
    "-c",
    "find /usr/share/nginx/html -type f -exec grep -l SYNTHETIC_GATEWAY_CANARY_71d909 {} \\;",
  ]);
  assert.equal(files.trim(), "");
});
gw(
  "GW-08",
  "disconnect/unavailable/real 60s timeout/no replay",
  async () => {
    const before = records.length;
    const disconnected = await request("/api/v1/disconnect", {
      method: "POST",
      body: canary,
    });
    assert.equal(disconnected.status, 502);
    assert.equal(records.length, before + 1);
    assert.equal(disconnected.headers["cache-control"], "no-store");
    const slow = await request("/api/v1/slow");
    assert.equal(slow.status, 504);
    assert.equal(slow.headers["cache-control"], "no-store");
    const unused = await port();
    const dead = runContainer({
      GATEWAY_API_HOSTPORT: `${hostAlias}:${unused}`,
    });
    try {
      const deadPort = publishedPort(dead);
      await waitForPort(deadPort, 502);
      const r = await request("/api/v1/echo", { port: deadPort });
      assert.equal(r.status, 502);
      assert.equal(r.headers["cache-control"], "no-store");
      assert(!r.body.includes("<script"));
    } finally {
      stopContainer(dead);
    }
  },
  90000,
);
gw("GW-09", "raw API-like paths cannot normalize into SPA", async () => {
  for (const target of [
    "/API/v1/session",
    "/Api/v1/session",
    "/api//v1/session",
    "/api/v1/../index.html",
    "/api%2Fv1/session",
    "/%61pi/v1/session",
    "/api/v1/%2e%2e/index.html",
    "/api\\v1/session",
  ]) {
    const r = await rawRequest(`GET ${target} HTTP/1.1`, [
      `Host: ${canonical}`,
    ]);
    assert.equal(r.status, 400);
    assert(!r.response.includes('<script type="module"'));
  }
  assert.match((await request("/api/v1/echo.css")).body, /MOCK_API_NOT_SPA/);
});
gw("GW-10", "explicit body/header/response limits/no temp canary", async () => {
  const limit = Buffer.alloc(1024 * 1024, "x");
  assert.equal(
    (
      await request("/api/v1/echo", {
        method: "POST",
        body: limit,
        headers: { "Content-Length": limit.length },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/v1/echo", {
        method: "POST",
        body: Buffer.alloc(limit.length + 1),
        headers: { "Content-Length": limit.length + 1 },
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await request("/api/v1/echo", {
        headers: { "X-Large-Fixture": "x".repeat(15000) },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/v1/echo", {
        headers: { "X-Large-Fixture": "x".repeat(17000) },
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/api/v1/response-header?size=15000")).status,
    200,
  );
  assert.equal(
    (await request("/api/v1/response-header?size=17000")).status,
    502,
  );
  assert.equal(
    docker([
      "exec",
      gateway,
      "sh",
      "-c",
      "find /tmp/projectx-gateway/client /tmp/projectx-gateway/proxy -type f -print",
    ]).trim(),
    "",
  );
});
gw(
  "GW-11",
  "unchanged compiled API entrypoint/guard closure",
  async () => {
    const mainPort = await port();
    const cleanEnv = {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      NODE_ENV: "test",
      STAFF_AUTH_ENABLED: "0",
      HOST: "127.0.0.1",
      PORT: String(mainPort),
      LOG_LEVEL: "silent",
    };
    mainProcess = spawn(process.execPath, ["apps/api/dist/main.js"], {
      cwd: root,
      env: cleanEnv,
      stdio: "ignore",
    });
    await waitForPort(mainPort);
    assert.equal((await request("/health", { port: mainPort })).status, 200);
    assert.equal(
      (await request("/api/v1/people/booked-by-names", { port: mainPort }))
        .status,
      401,
    );
    const { createApp } = await import(
      new URL("../../apps/api/dist/app.js", import.meta.url)
    );
    realApp = createApp(
      { NODE_ENV: "test", HOST: "127.0.0.1", PORT: 3001, LOG_LEVEL: "silent" },
      {
        staffAuth: {
          config: { origin },
          oidc: {},
          runtimePool: {},
          store: {
            read: async () => ({
              userId: "00000000-0000-4000-8000-000000000001",
              organizationId: "00000000-0000-4000-8000-000000000002",
              venueId: null,
              contextVersion: 1,
            }),
          },
        },
      },
    );
    await realApp.listen({ host: "127.0.0.1", port: 0 });
    const realPort = realApp.server.address().port;
    const guarded = runContainer({
      GATEWAY_API_HOSTPORT: `${hostAlias}:${realPort}`,
    });
    try {
      const guardedPort = publishedPort(guarded);
      await waitForPort(guardedPort);
      assert.equal(
        (await request("/api/v1/staff-auth/session", { port: guardedPort }))
          .status,
        401,
      );
      assert.equal(
        (
          await request("/api/v1/staff-auth/context", {
            port: guardedPort,
            method: "POST",
            headers: {
              Cookie: `__Host-projectx-session=${"a".repeat(43)}`,
              Origin: "https://foreign.invalid",
              "Content-Type": "application/json",
            },
            body: "{}",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/v1/staff-auth/session", {
            port: guardedPort,
            headers: { Host: "foreign.invalid" },
          })
        ).status,
        403,
      );
    } finally {
      stopContainer(guarded);
    }
  },
  20000,
);
gw(
  "GW-12",
  "injection/secret-env rejection/safe output/shutdown",
  async () => {
    await buildContextProof();
    const rejected = [
      { GATEWAY_CANONICAL_HOST: `evil.invalid;${canary}` },
      { GATEWAY_CANONICAL_HOST: "https://gateway.test.invalid" },
      { GATEWAY_API_HOSTPORT: `127.0.0.1:80;${canary}` },
      { GATEWAY_API_HOSTPORT: "http://127.0.0.1:80" },
      { GATEWAY_API_HOSTPORT: "127.0.0.1:0" },
      { GATEWAY_CANONICAL_HOST: "" },
      { GATEWAY_API_HOSTPORT: "" },
      { PORT: "80" },
      { GATEWAY_DNS_PORT: "0;unsafe" },
      { AUTH0_CLIENT_SECRET: canary },
      { DATABASE_URL: canary },
      { STAFF_RUNTIME_DATABASE_URL: canary },
    ];
    for (const env of rejected) {
      const name = runContainer(env);
      docker(["wait", name]);
      assert.equal(
        docker(["inspect", "--format", "{{.State.ExitCode}}", name]).trim(),
        "1",
      );
      const r = spawnSync("docker", ["logs", name], { encoding: "utf8" });
      assert(!`${r.stdout}${r.stderr}`.includes(canary));
      stopContainer(name);
    }
    const config = docker([
      "exec",
      gateway,
      "cat",
      "/tmp/projectx-gateway/nginx.conf",
    ]);
    assert(
      config.includes("resolve;") &&
        config.includes("resolver ") &&
        config.includes("valid=10s"),
    );
    // DNS source is real /etc/resolv.conf; actual Render DNS/HTTP2 remain live gates.
    await dnsRefreshProof();
    const logs = spawnSync("docker", ["logs", gateway], { encoding: "utf8" });
    assert(!`${logs.stdout}${logs.stderr}`.includes(canary));
    docker(["kill", "--signal", "SIGQUIT", gateway]);
    docker(["wait", gateway]);
    assert.equal(
      docker(["inspect", "--format", "{{.State.ExitCode}}", gateway]).trim(),
      "0",
    );
    docker(["rm", gateway]);
    containers.delete(gateway);
  },
  90000,
);
