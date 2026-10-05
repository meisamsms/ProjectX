import { spawnSync } from "node:child_process";
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const steps = [
  "install:check",
  "format:check",
  "lint",
  "typecheck",
  "test:unit",
  "test:auth",
  "contract:check",
  "map:check",
  "test:integration",
  "test:web",
  "test:e2e",
  "build",
];
for (const step of steps) {
  console.log(`\n=== ${step} ===`);
  const result = spawnSync(command, [step], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`${step}: FAIL`);
    process.exit(result.status || 1);
  }
  console.log(`${step}: PASS`);
}
console.log(
  "Database verification is a separate required CI gate: pnpm verify:db",
);
