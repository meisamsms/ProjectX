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
const files = [
  "people-core/20260928000100_people_core.sql",
  "people-grants/20260928000200_people_grants.sql",
  "people-rls/20260928000300_people_rls.sql",
  "people-roster-fields/20260928000400_people_roster_fields.sql",
  "people-user-provisioning/20261001000500_people_user_provisioning.sql",
  "people-z-direct-grants/20261001000600_people_direct_grants.sql",
];
const content = (name: string) =>
  readFile(new URL(`../../migrations/${name}`, import.meta.url), "utf8");
const checksum = (sql: string) =>
  createHash("sha256").update(sql).digest("hex");
afterAll(() => closeTestDatabase(pool));
async function ledger() {
  return (
    await pool.query(
      "SELECT name,checksum FROM projectx_test.schema_migrations ORDER BY name",
    )
  ).rows;
}
async function assertMigration() {
  expect(await ledger()).toEqual(
    await Promise.all(
      files.map(async (name) => ({
        name,
        checksum: checksum(await content(name)),
      })),
    ),
  );
  const tables = ["organization_permission_grants", "venue_permission_grants"];
  const flags = await pool.query(
    "SELECT relrowsecurity FROM pg_class WHERE relnamespace='projectx_test'::regnamespace AND relname=ANY($1::text[])",
    [tables],
  );
  expect(flags.rows).toEqual([
    { relrowsecurity: true },
    { relrowsecurity: true },
  ]);
  for (const table of tables) {
    const rights = await pool.query(
      "SELECT has_table_privilege('projectx_people_runtime',$1,'SELECT') s,has_table_privilege('projectx_people_runtime',$1,'INSERT') i,has_table_privilege('projectx_people_runtime',$1,'UPDATE') u,has_table_privilege('projectx_people_runtime',$1,'DELETE') d",
      [`projectx_test.${table}`],
    );
    expect(rights.rows[0]).toEqual({ s: true, i: true, u: true, d: false });
  }
}
describe("PEOPLE-04P forward direct-grant migration", () => {
  it("installs clean with RLS and exact checksums; repeat applies no changes", async () => {
    await resetTestDatabase(pool);
    await migrateTestDatabase();
    await assertMigration();
    const before = await ledger();
    await migrateTestDatabase();
    expect(await ledger()).toEqual(before);
  });
  it("upgrades the exact PEOPLE-04 schema without changing existing rows or ledger", async () => {
    await resetTestDatabase(pool);
    await withTransaction(pool, async (client) => {
      await client.query(
        "CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
      );
      for (const name of files.slice(0, 5)) {
        const sql = await content(name);
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
          [name, checksum(sql)],
        );
      }
      const f = await seedCorePeople(client);
      await client.query(
        "UPDATE users SET first_name='Preexisting' WHERE id=$1",
        [f.identities.orgA.user],
      );
    });
    const before = await pool.query(
      "SELECT * FROM projectx_test.users ORDER BY id",
    );
    const oldLedger = await ledger();
    await migrateTestDatabase();
    expect(
      (await pool.query("SELECT * FROM projectx_test.users ORDER BY id")).rows,
    ).toEqual(before.rows);
    expect((await ledger()).slice(0, 5)).toEqual(oldLedger);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int n FROM projectx_test.organization_permission_grants",
        )
      ).rows[0],
    ).toEqual({ n: 0 });
    await assertMigration();
  });
  it("rejects checksum drift without reapplying migrations", async () => {
    await resetTestDatabase(pool);
    await migrateTestDatabase();
    const name = files[5];
    await pool.query(
      "UPDATE projectx_test.schema_migrations SET checksum='bad' WHERE name=$1",
      [name],
    );
    await expect(migrateTestDatabase()).rejects.toThrow(
      "Modified applied migration",
    );
    expect((await ledger())[5].checksum).toBe("bad");
  });
});
