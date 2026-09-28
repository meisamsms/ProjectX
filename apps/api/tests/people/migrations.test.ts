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
afterAll(async () => closeTestDatabase(pool));
const name = "people-core/20260928000100_people_core.sql";
const sqlUrl = new URL(`../../migrations/${name}`, import.meta.url);

describe("People migration through approved runner", () => {
  it("installs clean schema with checksum, constraints, fixtures and repeatable ledger", async () => {
    await resetTestDatabase(pool);
    await migrateTestDatabase();
    const checksum = createHash("sha256")
      .update(await readFile(sqlUrl))
      .digest("hex");
    const ledger = await pool.query(
      "SELECT name, checksum FROM projectx_test.schema_migrations",
    );
    expect(ledger.rows).toEqual([{ name, checksum }]);
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='projectx_test' AND table_name <> 'schema_migrations' ORDER BY table_name",
    );
    expect(tables.rows.map((x) => x.table_name)).toEqual([
      "authenticated_identities",
      "organization_memberships",
      "organizations",
      "users",
      "venue_access",
      "venues",
    ]);
    const constraints = await pool.query(
      "SELECT conname FROM pg_constraint WHERE connamespace='projectx_test'::regnamespace",
    );
    for (const name of [
      "venue_access_membership_owner",
      "venue_access_venue_owner",
      "authenticated_identities_issuer_subject_key",
      "venues_organization_id_fkey",
    ])
      expect(constraints.rows.map((x) => x.conname)).toContain(name);
    const indexes = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname='projectx_test'",
    );
    expect(indexes.rows.map((x) => x.indexname)).toEqual(
      expect.arrayContaining([
        "organization_memberships_active_user_org",
        "venue_access_active_membership_venue",
      ]),
    );
    await expect(
      withTransaction(pool, async (client) => {
        await seedCorePeople(client);
        throw new Error("rollback fixture");
      }),
    ).rejects.toThrow("rollback fixture");
    await migrateTestDatabase();
    expect(
      (
        await pool.query(
          "SELECT name,checksum FROM projectx_test.schema_migrations",
        )
      ).rows,
    ).toEqual(ledger.rows);
  });
});
