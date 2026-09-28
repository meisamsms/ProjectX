import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import {
  closeTestDatabase,
  connectTestDatabase,
  resetTestDatabase,
  withTransaction,
} from "../database/harness.js";
import { migrateTestDatabase } from "../database/migrate.js";
import { seedCorePeople } from "./fixtures/core.js";

const pool = connectTestDatabase();
afterAll(() => closeTestDatabase(pool));
const core = "people-core/20260928000100_people_core.sql";
const grants = "people-grants/20260928000200_people_grants.sql";
const sql = (name: string) =>
  new URL(`../../migrations/${name}`, import.meta.url);
const checksum = async (name: string) =>
  createHash("sha256")
    .update(await readFile(sql(name)))
    .digest("hex");

async function snapshot() {
  const ledger = await pool.query(
    "SELECT name,checksum FROM projectx_test.schema_migrations ORDER BY name",
  );
  expect(ledger.rows).toEqual(
    expect.arrayContaining([
      { name: core, checksum: await checksum(core) },
      { name: grants, checksum: await checksum(grants) },
    ]),
  );
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='projectx_test'",
  );
  expect(tables.rows.map((x) => x.table_name)).toEqual(
    expect.arrayContaining([
      "permissions",
      "roles",
      "role_permissions",
      "organization_role_grants",
      "venue_role_grants",
    ]),
  );
  const constraints = await pool.query(
    "SELECT conname FROM pg_constraint WHERE connamespace='projectx_test'::regnamespace",
  );
  for (const name of [
    "role_permissions_role",
    "role_permissions_permission",
    "role_permissions_compatible",
    "org_grant_membership",
    "org_grant_role",
    "venue_grant_access",
    "venue_grant_role",
  ])
    expect(constraints.rows.map((x) => x.conname)).toContain(name);
  const triggers = await pool.query(
    "SELECT tgname FROM pg_trigger WHERE tgrelid IN ('projectx_test.organization_role_grants'::regclass,'projectx_test.venue_role_grants'::regclass) AND NOT tgisinternal",
  );
  expect(triggers.rows.map((x) => x.tgname)).toEqual(
    expect.arrayContaining([
      "organization_grant_active_parent",
      "venue_grant_active_parent",
    ]),
  );
  expect(
    (await pool.query("SELECT count(*)::int n FROM projectx_test.permissions"))
      .rows[0].n,
  ).toBe(22);
  await expect(
    withTransaction(pool, async (client) => {
      await seedCorePeople(client);
      throw Error("fixture rollback");
    }),
  ).rejects.toThrow("fixture rollback");
  await migrateTestDatabase();
  expect(
    (
      await pool.query(
        "SELECT name,checksum FROM projectx_test.schema_migrations ORDER BY name",
      )
    ).rows,
  ).toEqual(ledger.rows);
}

describe("PEOPLE-01B forward migration", () => {
  it("installs from clean schema with checksum-tracked deterministic seed", async () => {
    await resetTestDatabase(pool);
    await migrateTestDatabase();
    await snapshot();
  });
  it("upgrades verified PEOPLE-01 schema without replacing its ledger or data", async () => {
    await resetTestDatabase(pool);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL search_path TO projectx_test, public");
      await client.query(
        "CREATE TABLE projectx_test.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      await client.query((await readFile(sql(core))).toString());
      await client.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES ($1,$2)",
        [core, await checksum(core)],
      );
      await client.query(
        "INSERT INTO organizations(id,name) VALUES ('018fc7ef-4350-7a00-8000-000000000001','existing tenant')",
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await migrateTestDatabase();
    expect(
      (
        await pool.query(
          "SELECT name FROM projectx_test.organizations WHERE name='existing tenant'",
        )
      ).rowCount,
    ).toBe(1);
    await snapshot();
  });
});
