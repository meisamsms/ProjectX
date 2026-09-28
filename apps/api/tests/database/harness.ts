import { Pool, type PoolClient } from "pg";

const schema = "projectx_test";

function testUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw)
    throw new Error(
      "DATABASE_URL is required for real PostgreSQL database tests",
    );
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  const name = decodeURIComponent(url.pathname.slice(1));
  if (
    process.env.NODE_ENV !== "test" ||
    process.env.TEST_DATABASE !== "1" ||
    !name.endsWith("_test")
  ) {
    throw new Error(
      "Database tests require NODE_ENV=test, TEST_DATABASE=1 and a database name ending _test",
    );
  }
  return raw;
}

export function connectTestDatabase(): Pool {
  return new Pool({
    connectionString: testUrl(),
    max: 2,
    connectionTimeoutMillis: 5000,
  });
}

export async function closeTestDatabase(pool: Pool): Promise<void> {
  await pool.end();
}

export async function withTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO ${schema}, public`);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Destructive reset is confined to a fixed test-owned schema. */
export async function resetTestDatabase(pool: Pool): Promise<void> {
  testUrl();
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.query(`CREATE SCHEMA ${schema}`);
}
