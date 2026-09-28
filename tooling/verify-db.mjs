import { spawnSync } from "node:child_process";
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
for (const step of ["db:migrate:test", "test:database"]) {
  const result = spawnSync(command, [step], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NODE_ENV: "test" },
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
