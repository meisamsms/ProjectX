import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
const config = loadConfig(process.env);
const app = createApp(config);
const shutdown = async () => {
  await app.close();
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
await app.listen({ host: config.HOST, port: config.PORT });
