import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { auth0Oidc } from "../../src/staff-auth/oidc.js";
import { loadStaffAuthConfig } from "../../src/staff-auth/config.js";
import { secret } from "../../src/staff-auth/credentials.js";

import { config } from "./fixtures.js";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = {
  ...keys.publicKey.export({ format: "jwk" }),
  kid: "fixture",
  alg: "RS256",
  use: "sig",
};
const transaction = { state: secret(), nonce: secret(), verifier: secret() };
function signedToken(
  overrides: Record<string, unknown> = {},
  badSignature = false,
) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", kid: "fixture" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: config.issuer,
      aud: config.clientId,
      sub: "linked-staff",
      iat: now,
      exp: now + 300,
      nonce: transaction.nonce,
      ...overrides,
    }),
  ).toString("base64url");
  const data = `${header}.${payload}`;
  return `${data}.${badSignature ? Buffer.alloc(256).toString("base64url") : sign("RSA-SHA256", Buffer.from(data), keys.privateKey).toString("base64url")}`;
}
function adapter(
  overrides: Record<string, unknown> = {},
  badSignature = false,
) {
  return auth0Oidc(config, async (input, init) => {
    if (String(input).endsWith("/.well-known/jwks.json"))
      return Response.json({ keys: [jwk] });
    expect(String(input)).toBe("https://provider.test/oauth/token");
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("code_verifier")).toBe(transaction.verifier);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("redirect_uri")).toBe(config.callbackUri);
    return Response.json({
      access_token: "discarded-fixture-access-token",
      token_type: "Bearer",
      id_token: signedToken(overrides, badSignature),
    });
  });
}
const callback = (state = transaction.state) =>
  new URL(`${config.callbackUri}?code=test-code&state=${state}`);
describe("CORE-AUTH-02 maintained OIDC adapter", () => {
  it("Code + S256 PKCE, state/nonce, exact redirect, openid only; no refresh request", async () => {
    const url = new URL(await adapter().authorize(transaction));
    expect(url.origin).toBe("https://provider.test");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(transaction.state);
    expect(url.searchParams.get("nonce")).toBe(transaction.nonce);
    const proof = await adapter().callback(callback(), transaction);
    expect(proof).toMatchObject({
      issuer: config.issuer,
      subject: "linked-staff",
      authenticatedAt: null,
    });
    expect(JSON.stringify(proof)).not.toMatch(
      /access_token|id_token|discarded/,
    );
  });
  it.each([
    ["AUTH-N16 issuer", { iss: "https://attacker.test/" }],
    ["AUTH-N17 audience", { aud: "other-client" }],
    [
      "AUTH-N17 azp",
      { aud: [config.clientId, "other-client"], azp: "other-client" },
    ],
    ["AUTH-N18 expired", { exp: 1 }],
    ["AUTH-N18 future nbf", { nbf: Math.floor(Date.now() / 1000) + 3600 }],
    ["AUTH-N21 nonce", { nonce: "wrong" }],
    ["AUTH-N27 missing subject", { sub: "" }],
  ])("rejects %s", async (_label, claims) => {
    await expect(
      adapter(claims).callback(callback(), transaction),
    ).rejects.toThrow();
  });
  it("AUTH-N19 invalid RSA signature fails even on a TLS token response", async () => {
    await expect(
      adapter({}, true).callback(callback(), transaction),
    ).rejects.toThrow();
  });
  it("AUTH-N20 state and callback URI mismatch denied", async () => {
    await expect(
      adapter().callback(callback("wrong"), transaction),
    ).rejects.toThrow();
    await expect(
      adapter().callback(
        new URL("https://attacker.test/callback"),
        transaction,
      ),
    ).rejects.toThrow();
  });
  it("AUTH-N19 unavailable JWKS fails closed", async () => {
    const oidc = auth0Oidc(config, async (input) =>
      String(input).includes("jwks")
        ? new Response("unavailable", { status: 503 })
        : Response.json({
            access_token: "fixture",
            token_type: "Bearer",
            id_token: signedToken(),
          }),
    );
    await expect(oidc.callback(callback(), transaction)).rejects.toThrow();
  });
});
it("AUTH-N19 unsigned / algorithm-confusion token rejected", async () => {
  const unsigned = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${signedToken().split(".")[1]}.`;
  const oidc = auth0Oidc(config, async () =>
    Response.json({
      access_token: "discarded",
      token_type: "Bearer",
      id_token: unsigned,
    }),
  );
  await expect(oidc.callback(callback(), transaction)).rejects.toThrow();
});
it("AUTH-N20/21 missing state / nonce cannot yield verified identity", async () => {
  await expect(
    adapter().callback(new URL(`${config.callbackUri}?code=code`), transaction),
  ).rejects.toThrow();
  await expect(
    adapter({ nonce: undefined }).callback(callback(), transaction),
  ).rejects.toThrow();
});
it("AUTH-N22 bad PKCE / consumed code token error fails closed", async () => {
  const oidc = auth0Oidc(config, async () =>
    Response.json({ error: "invalid_grant" }, { status: 400 }),
  );
  await expect(oidc.callback(callback(), transaction)).rejects.toThrow();
});
describe("isolated configuration", () => {
  const env = {
    NODE_ENV: "test",
    STAFF_AUTH_ENABLED: "1",
    AUTH0_ISSUER: config.issuer,
    AUTH0_CLIENT_ID: config.clientId,
    AUTH0_CLIENT_SECRET: config.clientSecret,
    AUTH0_CALLBACK_URI: config.callbackUri,
    AUTH0_POST_LOGOUT_URI: config.postLogoutUri,
    STAFF_APP_ORIGIN: config.origin,
    STAFF_RUNTIME_DATABASE_URL: config.runtimeDatabaseUrl,
  };
  it("accepts exact HTTPS canonical configuration", () =>
    expect(loadStaffAuthConfig(env)).toMatchObject(config));
  it.each([
    "AUTH0_ISSUER",
    "AUTH0_CLIENT_ID",
    "AUTH0_CLIENT_SECRET",
    "AUTH0_CALLBACK_URI",
    "AUTH0_POST_LOGOUT_URI",
    "STAFF_APP_ORIGIN",
    "STAFF_RUNTIME_DATABASE_URL",
  ])("missing %s fails without values", (key) => {
    expect(() => loadStaffAuthConfig({ ...env, [key]: "" })).toThrow(
      "Invalid staff authentication configuration",
    );
  });
  it("production/staging cannot silently use local health-only defaults", () => {
    for (const NODE_ENV of ["production", "staging"])
      expect(() => loadStaffAuthConfig({ NODE_ENV })).toThrow();
  });
  it.each([
    { AUTH0_ISSUER: "http://provider.test/" },
    { AUTH0_CALLBACK_URI: "https://attacker.test/callback" },
    { STAFF_APP_ORIGIN: "https://app.test/not-origin" },
    { AUTH0_ISSUER: "https://provider.test/?issuer=attacker" },
  ])("invalid URL boundary rejected", (change) =>
    expect(() => loadStaffAuthConfig({ ...env, ...change })).toThrow(),
  );
});
