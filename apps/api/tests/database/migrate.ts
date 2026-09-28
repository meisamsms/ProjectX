import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeTestDatabase, connectTestDatabase } from "./harness.js";

/** Ordered transactional SQL runner for disposable test databases. */
export async function migrateTestDatabase(): Promise<void> {
  const pool = connectTestDatabase();
  const root = fileURLToPath(new URL("../../migrations/", import.meta.url));
  try {
    const files: string[] = [];
    for (const directory of await readdir(root, { withFileTypes: true })) {
      if (!directory.isDirectory()) continue;
      for (const entry of await readdir(resolve(root, directory.name))) {
        if (entry.endsWith(".sql")) files.push(`${directory.name}/${entry}`);
      }
    }
    files.sort();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(9410081)");
      await client.query("CREATE SCHEMA IF NOT EXISTS projectx_test");
      await client.query("SET LOCAL search_path TO projectx_test, public");
      await client.query(
        "CREATE TABLE IF NOT EXISTS projectx_test.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      for (const name of files) {
        const sql = await readFile(resolve(root, name), "utf8");
        const checksum = createHash("sha256").update(sql).digest("hex");
        const prior = await client.query(
          "SELECT checksum FROM projectx_test.schema_migrations WHERE name = $1",
          [name],
        );
        if (prior.rowCount) {
          if (prior.rows[0].checksum !== checksum)
            throw new Error(`Modified applied migration: ${name}`);
          continue;
        }
        await client.query(sql);
        await client.query(
          "INSERT INTO projectx_test.schema_migrations (name, checksum) VALUES ($1, $2)",
          [name, checksum],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await closeTestDatabase(pool);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  migrateTestDatabase()
    .then(() => console.log("Test migrations applied"))
    .catch((error) => {
      console.error(
        error instanceof Error ? error.message : "Database migration failed",
      );
      process.exitCode = 1;
    });
}
