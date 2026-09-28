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
    "apps/api/tests/people/migrations.test.ts",
    "apps/api/tests/people/core-persistence.test.ts",
    "apps/api/tests/people/grants-migrations.test.ts",
    "apps/api/tests/people/grants.test.ts",
    "apps/api/tests/people/rls-migrations.test.ts",
    "apps/api/tests/people/authorization.test.ts",
    "apps/api/tests/people/rls.test.ts",
    "--no-file-parallelism",
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NODE_ENV: "test" },
  },
);
process.exit(result.status ?? 1);
