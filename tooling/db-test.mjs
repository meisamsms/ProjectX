import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  command,
  [
    "exec",
    "vitest",
    "run",
    "apps/api/tests/database/postgres-runtime.test.ts",
    "apps/api/tests/database/transaction.test.ts",
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NODE_ENV: "test" },
  },
);
process.exit(result.status ?? 1);
