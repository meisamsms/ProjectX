import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    launchOptions: process.env.PROJECTX_CHROMIUM_PATH ? { executablePath: process.env.PROJECTX_CHROMIUM_PATH, args: ["--no-sandbox"] } : {},
  },
  webServer: { command: "pnpm --filter @projectx/web dev", url: "http://127.0.0.1:4173", reuseExistingServer: false, timeout: 30000 },
  reporter: "list",
});
