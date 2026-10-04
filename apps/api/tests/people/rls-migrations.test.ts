import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import {
  closeTestDatabase,
  connectTestDatabase,
  resetTestDatabase,
} from "../database/harness.js";
import { migrateTestDatabase } from "../database/migrate.js";

const pool = connectTestDatabase();
afterAll(() => closeTestDatabase(pool));
const files = [
  "people-core/20260928000100_people_core.sql",
  "people-grants/20260928000200_people_grants.sql",
  "people-rls/20260928000300_people_rls.sql",
  "people-roster-fields/20260928000400_people_roster_fields.sql",
  "people-user-provisioning/20261001000500_people_user_provisioning.sql",
  "people-z-direct-grants/20261001000600_people_direct_grants.sql",
  "people-zz-booked-by/20261002000700_people_booked_by.sql",
  "people-zzz-server-names/20261003000800_people_server_names.sql",
];
const content = (name: string) =>
  readFile(new URL(`../../migrations/${name}`, import.meta.url));
const checksum = async (name: string) =>
  createHash("sha256")
    .update(await content(name))
    .digest("hex");
async function assertPhysical() {
  const ledger = await pool.query(
    "SELECT name,checksum FROM projectx_test.schema_migrations ORDER BY name",
  );
  expect(ledger.rows).toEqual(
    await Promise.all(
      files.map(async (name) => ({ name, checksum: await checksum(name) })),
    ),
  );
  const tables = [
    "organizations",
    "venues",
    "users",
    "authenticated_identities",
    "organization_memberships",
    "venue_access",
    "roles",
    "role_permissions",
    "organization_role_grants",
    "venue_role_grants",
  ];
  const flags = await pool.query(
    "SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='projectx_test'::regnamespace AND relname=ANY($1::text[])",
    [tables],
  );
  expect(flags.rows).toHaveLength(tables.length);
  expect(flags.rows.every((r) => r.relrowsecurity === true)).toBe(true);
  const policies = await pool.query(
    "SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='projectx_test'",
  );
  for (const name of tables)
    expect(
      policies.rows.some((p) => p.tablename === name && p.cmd === "SELECT"),
    ).toBe(true);
  for (const name of [
    "roles",
    "role_permissions",
    "organization_role_grants",
    "venue_role_grants",
  ]) {
    expect(
      policies.rows.some(
        (p) => p.tablename === name && p.cmd === "INSERT" && p.with_check,
      ),
    ).toBe(true);
    expect(
      policies.rows.some(
        (p) =>
          p.tablename === name && p.cmd === "UPDATE" && p.qual && p.with_check,
      ),
    ).toBe(true);
  }
  expect(policies.rows.every((p) => p.cmd !== "DELETE")).toBe(true);
  const role = await pool.query(
    "SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='projectx_people_runtime'",
  );
  expect(role.rows[0]).toEqual({
    rolcanlogin: false,
    rolsuper: false,
    rolbypassrls: false,
    rolcreatedb: false,
    rolcreaterole: false,
  });
  await migrateTestDatabase();
  expect(
    (
      await pool.query(
        "SELECT name,checksum FROM projectx_test.schema_migrations ORDER BY name",
      )
    ).rows,
  ).toEqual(ledger.rows);
}

describe("PEOPLE-02 forward RLS migration", () => {
  it("installs clean People schema and policies with checksum tracking", async () => {
    await resetTestDatabase(pool);
    await migrateTestDatabase();
    await assertPhysical();
  });
  it("upgrades a verified PEOPLE-01B schema while preserving its data and ledger", async () => {
    await resetTestDatabase(pool);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL search_path TO projectx_test, public");
      await client.query(
        "CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
      );
      for (const name of files.slice(0, 2)) {
        await client.query((await content(name)).toString());
        await client.query(
          "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
          [name, await checksum(name)],
        );
      }
      await client.query(
        "INSERT INTO organizations(id,name) VALUES ('018fc7ef-4350-7a00-8000-000000000001','preexisting tenant')",
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
          "SELECT name FROM projectx_test.organizations WHERE name='preexisting tenant'",
        )
      ).rowCount,
    ).toBe(1);
    await assertPhysical();
  });
});
