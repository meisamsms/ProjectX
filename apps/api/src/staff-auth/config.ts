export interface StaffAuthConfig {
  readonly issuer: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly callbackUri: string;
  readonly postLogoutUri: string;
  readonly origin: string;
  readonly runtimeDatabaseUrl: string;
}

/** Auth0 confidential web client; no request-derived discovery or redirect URLs. */
export function loadStaffAuthConfig(
  env: NodeJS.ProcessEnv,
): StaffAuthConfig | undefined {
  const enabled = env.STAFF_AUTH_ENABLED === "1";
  if (!enabled) {
    if (env.NODE_ENV === "production" || env.NODE_ENV === "staging")
      throw new Error("Staff authentication configuration required");
    return undefined;
  }
  try {
    const required = (name: string) => {
      const value = env[name];
      if (!value || value.trim() !== value) throw new Error();
      return value;
    };
    const origin = new URL(required("STAFF_APP_ORIGIN"));
    const issuer = new URL(required("AUTH0_ISSUER"));
    const callback = new URL(required("AUTH0_CALLBACK_URI"));
    const logout = new URL(required("AUTH0_POST_LOGOUT_URI"));
    for (const url of [origin, issuer, callback, logout]) {
      if (url.protocol !== "https:" || url.username || url.password || url.hash)
        throw new Error();
    }
    if (
      origin.href !== `${origin.origin}/` ||
      issuer.href !== `${issuer.origin}/` ||
      callback.origin !== origin.origin ||
      callback.pathname !== "/api/v1/staff-auth/callback" ||
      callback.search ||
      logout.origin !== origin.origin ||
      logout.search
    )
      throw new Error();
    const runtimeDatabaseUrl = required("STAFF_RUNTIME_DATABASE_URL");
    const database = new URL(runtimeDatabaseUrl);
    if (!["postgres:", "postgresql:"].includes(database.protocol))
      throw new Error();
    return Object.freeze({
      issuer: issuer.href,
      clientId: required("AUTH0_CLIENT_ID"),
      clientSecret: required("AUTH0_CLIENT_SECRET"),
      callbackUri: callback.href,
      postLogoutUri: logout.href,
      origin: origin.origin,
      runtimeDatabaseUrl,
    });
  } catch {
    // Never attach the invalid URL/credential to this error.
    throw new Error("Invalid staff authentication configuration");
  }
}
