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

test("connects to an actual PostgreSQL test database", async () => {
  const result = await pool.query(
    "SELECT version() AS version, current_database() AS database",
  );
  expect(result.rows[0].version).toMatch(/^PostgreSQL 16\./);
  expect(result.rows[0].database).toMatch(/_test$/);
});

test("releases and reacquires pooled connections", async () => {
  const first = await pool.connect();
  const pid = (await first.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  first.release();
  const second = await pool.connect();
  try {
    expect(
      (await second.query("SELECT pg_backend_pid() AS pid")).rows[0].pid,
    ).toBe(pid);
  } finally {
    second.release();
  }
});
