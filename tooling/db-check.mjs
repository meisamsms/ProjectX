import { spawnSync } from "node:child_process";
if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is required for real PostgreSQL database verification",
  );
  process.exit(1);
}
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  command,
  ["exec", "vitest", "run", "apps/api/tests/database/postgres-runtime.test.ts"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NODE_ENV: "test" },
  },
);
process.exit(result.status ?? 1);
