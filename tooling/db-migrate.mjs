import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  command,
  [
    "--filter",
    "@projectx/api",
    "exec",
    "node",
    "--import",
    "tsx",
    "tests/database/migrate.ts",
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NODE_ENV: "test" },
  },
);
process.exit(result.status ?? 1);
