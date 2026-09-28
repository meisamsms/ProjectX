import { afterAll, beforeAll, expect, test } from "vitest";
import type { Pool } from "pg";
import { closeTestDatabase, connectTestDatabase } from "./harness.js";

let pool: Pool;
beforeAll(() => {
  pool = connectTestDatabase();
});
afterAll(async () => {
  if (pool) await closeTestDatabase(pool);
});

test("BEGIN/write/ROLLBACK leaves no committed row", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "CREATE TEMP TABLE rollback_probe (value integer) ON COMMIT DROP",
    );
    await client.query("INSERT INTO rollback_probe (value) VALUES ($1)", [42]);
    expect(
      (await client.query("SELECT value FROM rollback_probe")).rows[0].value,
    ).toBe(42);
    await client.query("ROLLBACK");
    const exists = await client.query(
      "SELECT to_regclass('pg_temp.rollback_probe') AS relation",
    );
    expect(exists.rows[0].relation).toBeNull();
  } finally {
    client.release();
  }
});
