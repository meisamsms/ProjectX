import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import {
  hash,
  secret,
  csrfFor,
  SESSION_COOKIE,
  cookieCredential,
} from "../../src/staff-auth/credentials.js";
import type { LoginTransaction } from "../../src/staff-auth/oidc.js";
import type {
  StaffSession,
  StaffSessionStore,
} from "../../src/staff-auth/store.js";
import { config } from "./fixtures.js";

const base = "/api/v1/staff-auth";
const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});
function fixture() {
  const cookie = secret(),
    org = randomUUID(),
    venue = randomUUID();
  let session: StaffSession | null = {
    userId: randomUUID(),
    organizationId: org,
    venueId: venue,
    contextVersion: 1,
    expiresAt: new Date(Date.now() + 43200000).toISOString(),
    assurance: "UNVERIFIED",
    contexts: [{ organizationId: org, venueId: venue }],
  };
  const transactions = new Map<string, LoginTransaction>();
  const store: StaffSessionStore = {
    async startLogin(h, t) {
      transactions.set(h, t);
    },
    async consumeLogin(h) {
      const t = transactions.get(h) ?? null;
      transactions.delete(h);
      return t;
    },
    async issue(proof, h) {
      if (proof.subject !== "linked") return null;
      accepted.add(h);
      return session;
    },
    async read(h) {
      return accepted.has(h) ? session : null;
    },
    async switch(h, candidateOrg, candidateVenue, version) {
      if (!accepted.has(h) || !session) return null;
      if (version !== session.contextVersion) return { denial: "STALE" };
      if (candidateOrg !== org || candidateVenue !== venue)
        return { denial: "CONTEXT" };
      session = { ...session, contextVersion: session.contextVersion + 1 };
      return session;
    },
    async revoke(h) {
      accepted.delete(h);
    },
  };
  const accepted = new Set([hash(cookie)]),
    logs: string[] = [];
  const output = new PassThrough();
  output.on("data", (chunk) => logs.push(String(chunk)));
  const pool = {
    query: vi.fn(() => {
      throw new Error("No protected query expected");
    }),
  } as unknown as Pool;
  const oidc = {
    async authorize(t: LoginTransaction) {
      return `https://provider.test/authorize?state=${t.state}&nonce=${t.nonce}`;
    },
    async callback(url: URL, t: LoginTransaction) {
      if (
        url.searchParams.get("state") !== t.state ||
        url.searchParams.get("code") !== "linked"
      )
        throw Error("canary-provider-token");
      return {
        issuer: config.issuer,
        subject: "linked",
        authenticatedAt: null,
      };
    },
  };
  const app = createApp(loadConfig({ NODE_ENV: "test", LOG_LEVEL: "info" }), {
    loggerStream: output,
    staffAuth: { config, store, oidc, runtimePool: pool },
  });
  apps.push(app);
  const headers = {
    host: "app.test",
    cookie: `${SESSION_COOKIE}=${cookie}`,
    origin: config.origin,
    "x-projectx-csrf": csrfFor(cookie),
    "x-projectx-context-version": "1",
  };
  return {
    app,
    store,
    pool,
    headers,
    cookie,
    org,
    venue,
    logs,
    accepted,
    transactions,
    disable: () => {
      session = null;
    },
  };
}
describe("CORE-AUTH-02 HTTP/session boundary", () => {
  it("AUTH-N09 valid cookie ignores spoofed actor/tenant/permission headers", async () => {
    const f = fixture();
    const original = (
      await f.app.inject({ url: `${base}/session`, headers: f.headers })
    ).json();
    const r = await f.app.inject({
      url: `${base}/session`,
      headers: {
        ...f.headers,
        "x-user-id": randomUUID(),
        "x-organization-id": randomUUID(),
        "x-venue-id": randomUUID(),
        "x-permissions": "user.manage",
      },
    });
    expect(r.json()).toEqual(original);
  });
  it("AUTH-N25 already expired local logout is idempotent but still requires CSRF", async () => {
    const f = fixture();
    f.disable();
    expect(
      (
        await f.app.inject({
          method: "POST",
          url: `${base}/logout`,
          headers: { ...f.headers, "x-projectx-csrf": "wrong" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await f.app.inject({
          method: "POST",
          url: `${base}/logout`,
          headers: f.headers,
        })
      ).statusCode,
    ).toBe(204);
  });
  it("AUTH-N01/N02 missing and forged credentials deny before module SQL", async () => {
    const f = fixture();
    for (const cookie of ["", `${SESSION_COOKIE}=${secret()}`]) {
      const response = await f.app.inject({
        url: "/api/v1/people/accounts",
        headers: { host: "app.test", cookie, "x-user-id": randomUUID() },
      });
      expect(response.statusCode).toBe(401);
      expect(f.pool.query).not.toHaveBeenCalled();
    }
  });
  it("same-origin session response carries only safe context and bound CSRF, never cookie/provider tokens", async () => {
    const f = fixture();
    const result = await f.app.inject({
      url: `${base}/session`,
      headers: f.headers,
    });
    expect(result.statusCode).toBe(200);
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.json().csrfToken).toBe(csrfFor(f.cookie));
    expect(result.body).not.toContain(f.cookie);
    expect(result.body).not.toContain(config.clientSecret);
  });
  it.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
    "AUTH-N23 %s missing/mismatched CSRF denied before work",
    async (method) => {
      const f = fixture();
      for (const token of ["", "wrong"]) {
        const response = await f.app.inject({
          method,
          url: "/api/v1/people/booked-by-names",
          headers: { ...f.headers, "x-projectx-csrf": token },
          payload: { displayName: "safe" },
        });
        expect(response.statusCode).toBe(403);
        expect(f.pool.query).not.toHaveBeenCalled();
      }
    },
  );
  it.each(["null", "https://attacker.test", ""])(
    "AUTH-N24 invalid Origin %s denied",
    async (origin) => {
      const f = fixture();
      const response = await f.app.inject({
        method: "POST",
        url: `${base}/logout`,
        headers: { ...f.headers, origin },
      });
      expect(response.statusCode).toBe(403);
      expect(f.accepted.has(hash(f.cookie))).toBe(true);
    },
  );
  it("AUTH-N24 foreign Host and forwarded Host cannot control configured authority", async () => {
    const f = fixture();
    for (const headers of [
      { ...f.headers, host: "attacker.test" },
      { ...f.headers, "x-forwarded-host": "attacker.test" },
    ]) {
      expect(
        (await f.app.inject({ url: `${base}/session`, headers })).statusCode,
      ).toBe(403);
    }
  });
  it("AUTH-N24 absent Origin requires same-origin Referer", async () => {
    const f = fixture();
    const { origin: _, ...headers } = f.headers;
    expect(
      (await f.app.inject({ method: "POST", url: `${base}/logout`, headers }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await f.app.inject({
          method: "POST",
          url: `${base}/logout`,
          headers: { ...headers, referer: `${config.origin}/staff` },
        })
      ).statusCode,
    ).toBe(204);
  });
  it("AUTH-N25 logout invalidates before cookie removal; reuse denied", async () => {
    const f = fixture();
    const response = await f.app.inject({
      method: "POST",
      url: `${base}/logout`,
      headers: f.headers,
    });
    expect(response.statusCode).toBe(204);
    expect(f.accepted.has(hash(f.cookie))).toBe(false);
    expect(String(response.headers["set-cookie"])).toContain("Max-Age=0");
    expect(
      (await f.app.inject({ url: `${base}/session`, headers: f.headers }))
        .statusCode,
    ).toBe(401);
  });
  it("AUTH-N30 store failures fail closed; failed invalidate never reports logout success", async () => {
    const f = fixture();
    vi.spyOn(f.store, "revoke").mockRejectedValueOnce(
      Error("canary-db-secret"),
    );
    const result = await f.app.inject({
      method: "POST",
      url: `${base}/logout`,
      headers: f.headers,
    });
    expect(result.statusCode).toBe(500);
    expect(result.headers["set-cookie"]).toBeUndefined();
    expect(result.body).not.toContain("canary-db-secret");
    vi.spyOn(f.store, "read").mockRejectedValueOnce(Error("canary-db-secret"));
    expect(
      (await f.app.inject({ url: `${base}/session`, headers: f.headers }))
        .statusCode,
    ).toBe(500);
  });
  it("AUTH-N31 stale context cannot retarget a mutation; switch changes version", async () => {
    const f = fixture();
    const switched = await f.app.inject({
      method: "POST",
      url: `${base}/context`,
      headers: f.headers,
      payload: { organizationId: f.org, venueId: f.venue, contextVersion: 1 },
    });
    expect(switched.statusCode).toBe(200);
    expect(switched.json().contextVersion).toBe(2);
    const old = await f.app.inject({
      method: "POST",
      url: "/api/v1/people/booked-by-names",
      headers: f.headers,
      payload: { displayName: "old tab" },
    });
    expect(old.statusCode).toBe(409);
    expect(f.pool.query).not.toHaveBeenCalled();
  });
  it("AUTH-N10/11/12/13 foreign and nonexistent context selections are indistinguishable", async () => {
    const f = fixture();
    for (const [organizationId, venueId] of [
      [randomUUID(), f.venue],
      [f.org, randomUUID()],
    ]) {
      const result = await f.app.inject({
        method: "POST",
        url: `${base}/context`,
        headers: f.headers,
        payload: { organizationId, venueId, contextVersion: 1 },
      });
      expect(result.statusCode).toBe(403);
      expect(result.json().message).toBe("Request denied");
    }
  });
  it("AUTH-N32 high-risk Add User cannot use unverified/browsersupplied assurance", async () => {
    const f = fixture();
    const r = await f.app.inject({
      method: "POST",
      url: "/api/v1/people/accounts",
      headers: { ...f.headers, "x-mfa": "true" },
      payload: {},
    });
    expect(r.statusCode).toBe(403);
    expect(f.pool.query).not.toHaveBeenCalled();
  });
  it("AUTH-N20/22/26 login cookie correlates a single-use transaction; Secure host cookies only", async () => {
    const f = fixture();
    const start = await f.app.inject({
      url: `${base}/login`,
      headers: { host: "app.test" },
    });
    const loginCookie = String(start.headers["set-cookie"]).split(";")[0] ?? "";
    expect(String(start.headers["set-cookie"])).toContain(
      "Secure; HttpOnly; SameSite=Lax",
    );
    expect(String(start.headers["set-cookie"])).not.toContain("Domain=");
    const state = new URL(String(start.headers.location)).searchParams.get(
      "state",
    );
    const callback = await f.app.inject({
      url: `${base}/callback?code=linked&state=${state}`,
      headers: { host: "app.test", cookie: loginCookie },
    });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe(`${config.origin}/`);
    expect(String(callback.headers["set-cookie"])).toContain(SESSION_COOKIE);
    const again = await f.app.inject({
      url: `${base}/callback?code=linked&state=${state}`,
      headers: { host: "app.test", cookie: loginCookie },
    });
    expect(again.statusCode).toBe(401);
  });
  it("AUTH-N33 callback URL/secret canaries do not appear in logs or error responses", async () => {
    const f = fixture();
    const start = await f.app.inject({
      url: `${base}/login`,
      headers: { host: "app.test" },
    });
    const response = await f.app.inject({
      url: `${base}/callback?code=canary-authorization-code&state=canary-state`,
      headers: {
        host: "app.test",
        cookie: String(start.headers["set-cookie"]).split(";")[0],
      },
    });
    const output = f.logs.join("") + response.body;
    for (const canary of [
      "canary-authorization-code",
      "canary-state",
      "canary-provider-token",
      config.clientSecret,
      String(start.headers.location),
      String(start.headers["set-cookie"]),
    ])
      expect(output).not.toContain(canary);
  });
  it("duplicate cookies rejected instead of choosing an attacker value", () => {
    const c = secret();
    expect(
      cookieCredential(
        `${SESSION_COOKIE}=${c}; ${SESSION_COOKIE}=${c}`,
        SESSION_COOKIE,
      ),
    ).toBeNull();
  });
});
