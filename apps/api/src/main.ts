import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { loadStaffAuthConfig } from "./staff-auth/config.js";
import { auth0Oidc } from "./staff-auth/oidc.js";
import { createStaffRuntimePool } from "./staff-auth/runtime.js";
import { postgresStaffStore } from "./staff-auth/store.js";
const config = loadConfig(process.env);
const auth = loadStaffAuthConfig(process.env);
const pool = auth ? await createStaffRuntimePool(auth) : undefined;
const app = createApp(
  config,
  auth && pool
    ? {
        staffAuth: {
          config: auth,
          oidc: auth0Oidc(auth),
          store: postgresStaffStore(pool),
          runtimePool: pool,
        },
      }
    : undefined,
);
app.addHook("onClose", async () => {
  await pool?.end();
});
const shutdown = async () => {
  await app.close();
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
await app.listen({ host: config.HOST, port: config.PORT });
