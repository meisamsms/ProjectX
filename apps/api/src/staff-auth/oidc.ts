import * as client from "openid-client";
import type { StaffAuthConfig } from "./config.js";

export interface LoginProof {
  readonly issuer: string;
  readonly subject: string;
  readonly authenticatedAt: Date | null;
}
export interface LoginTransaction {
  readonly state: string;
  readonly nonce: string;
  readonly verifier: string;
}
export interface StaffOidc {
  authorize(transaction: LoginTransaction): Promise<string>;
  callback(url: URL, transaction: LoginTransaction): Promise<LoginProof>;
}

/** Fixed Auth0 endpoints; TLS and JWS validation both required. Tokens are discarded. */
export function auth0Oidc(
  config: StaffAuthConfig,
  transport?: client.CustomFetch,
): StaffOidc {
  const oidc = new client.Configuration(
    {
      issuer: config.issuer,
      authorization_endpoint: new URL("authorize", config.issuer).href,
      token_endpoint: new URL("oauth/token", config.issuer).href,
      jwks_uri: new URL(".well-known/jwks.json", config.issuer).href,
    },
    config.clientId,
    {
      id_token_signed_response_alg: "RS256",
      [client.clockTolerance]: 0,
    },
    client.ClientSecretPost(config.clientSecret),
  );
  client.enableNonRepudiationChecks(oidc);
  if (transport) oidc[client.customFetch] = transport;
  return {
    async authorize(transaction) {
      return client.buildAuthorizationUrl(oidc, {
        response_type: "code",
        redirect_uri: config.callbackUri,
        scope: "openid",
        code_challenge_method: "S256",
        code_challenge: await client.calculatePKCECodeChallenge(
          transaction.verifier,
        ),
        state: transaction.state,
        nonce: transaction.nonce,
      }).href;
    },
    async callback(url, transaction) {
      if (url.origin + url.pathname !== config.callbackUri)
        throw new Error("Invalid callback");
      const result = await client.authorizationCodeGrant(oidc, url, {
        expectedState: transaction.state,
        expectedNonce: transaction.nonce,
        pkceCodeVerifier: transaction.verifier,
        idTokenExpected: true,
      });
      const claims = result.claims();
      if (
        !claims ||
        claims.iss !== config.issuer ||
        !claims.sub ||
        claims.sub.length > 1024
      )
        throw new Error("Invalid identity proof");
      // Auth0 MFA/auth_time semantics are not assumed verified from an amr string.
      return Object.freeze({
        issuer: claims.iss,
        subject: claims.sub,
        authenticatedAt:
          typeof claims.auth_time === "number"
            ? new Date(claims.auth_time * 1000)
            : null,
      });
    },
  };
}
