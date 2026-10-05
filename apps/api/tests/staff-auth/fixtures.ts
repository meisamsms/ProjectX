import type { StaffAuthConfig } from "../../src/staff-auth/config.js";
export const config: StaffAuthConfig = {
  issuer: "https://provider.test/",
  clientId: "staff-test",
  clientSecret: "test-only-canary-client-secret",
  callbackUri: "https://app.test/api/v1/staff-auth/callback",
  postLogoutUri: "https://app.test/",
  origin: "https://app.test",
  runtimeDatabaseUrl: "postgresql://unused/isolated_test",
};
