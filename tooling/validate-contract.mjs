import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import SwaggerParser from "@apidevtools/swagger-parser";
await SwaggerParser.validate("packages/contracts/openapi.json");
const directory = mkdtempSync(join(tmpdir(), "projectx-contract-"));
try {
  const output = join(directory, "api.ts");
  const binary = join(
    "node_modules",
    ".bin",
    process.platform === "win32"
      ? "openapi-typescript.cmd"
      : "openapi-typescript",
  );
  const run = spawnSync(
    binary,
    ["packages/contracts/openapi.json", "-o", output],
    { stdio: "pipe", shell: process.platform === "win32" },
  );
  if (run.status !== 0) throw Error(`OpenAPI generation failed: ${run.stderr}`);
  if (
    readFileSync(output, "utf8") !==
    readFileSync("packages/contracts/generated/api.ts", "utf8")
  )
    throw Error("Generated API types are stale");
  console.log("OpenAPI validity and generated-type freshness PASS");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
