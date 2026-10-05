import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import {
  bindVerifiedPeopleIdentity,
  withAuthorizedPeopleTransaction,
} from "../../src/people/authorization/context.js";
import {
  closeTestDatabase,
  connectTestDatabase,
  resetTestDatabase,
  withTransaction,
} from "../database/harness.js";
import { migrateTestDatabase } from "../database/migrate.js";
import { newPeopleId } from "../../src/people/persistence/id.js";
import { seedCorePeople } from "./fixtures/core.js";
import {
  adminPool,
  freshPeopleFixture,
  startRuntime,
  stopRuntime,
} from "./fixtures/runtime.js";

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
  "staff-auth/20261005000900_staff_sessions.sql",
];
const content = (name: string) =>
  readFile(new URL(`../../migrations/${name}`, import.meta.url));
const checksum = async (name: string) =>
  createHash("sha256")
    .update(await content(name))
    .digest("hex");
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
      files.map(async (name) => ({ name, checksum: await checksum(name) })),
    ),
  );
  const columns = await pool.query(
    "SELECT table_name,column_name,is_nullable,data_type FROM information_schema.columns WHERE table_schema='projectx_test' AND ((table_name='users' AND column_name IN ('first_name','last_name')) OR (table_name='organization_memberships' AND column_name IN ('job_title','email_notifications_enabled'))) ORDER BY table_name,column_name",
  );
  expect(columns.rows).toEqual([
    {
      table_name: "organization_memberships",
      column_name: "email_notifications_enabled",
      is_nullable: "YES",
      data_type: "boolean",
    },
    {
      table_name: "organization_memberships",
      column_name: "job_title",
      is_nullable: "YES",
      data_type: "text",
    },
    {
      table_name: "users",
      column_name: "first_name",
      is_nullable: "YES",
      data_type: "text",
    },
    {
      table_name: "users",
      column_name: "last_name",
      is_nullable: "YES",
      data_type: "text",
    },
  ]);
  const flags = await pool.query(
    "SELECT relname,relrowsecurity FROM pg_class WHERE oid IN ('projectx_test.users'::regclass,'projectx_test.organization_memberships'::regclass) ORDER BY relname",
  );
  expect(flags.rows).toEqual([
    { relname: "organization_memberships", relrowsecurity: true },
    { relname: "users", relrowsecurity: true },
  ]);
  const prior = await ledger();
  await migrateTestDatabase();
  expect(await ledger()).toEqual(prior);
}

describe("PEOPLE-03P roster fields on PostgreSQL 16", () => {
  it("installs nullable fields on clean schema with checksum and RLS intact", async () => {
    await resetTestDatabase(pool);
    await migrateTestDatabase();
    await assertMigration();
    const f = await withTransaction(pool, seedCorePeople);
    const defaults = await pool.query(
      "SELECT u.first_name,u.last_name,m.job_title,m.email_notifications_enabled FROM projectx_test.users u JOIN projectx_test.organization_memberships m ON m.user_id=u.id WHERE m.id=$1",
      [f.identities.orgA.membership],
    );
    expect(defaults.rows[0]).toEqual({
      first_name: null,
      last_name: null,
      job_title: null,
      email_notifications_enabled: null,
    });
  });

  it("upgrades verified PEOPLE-02 data without changing prior migration checksums", async () => {
    await resetTestDatabase(pool);
    const client = await pool.connect();
    let existing: { user: string; membership: string } | undefined;
    try {
      await client.query("BEGIN");
      await client.query("CREATE SCHEMA IF NOT EXISTS projectx_test");
      await client.query("SET LOCAL search_path TO projectx_test, public");
      await client.query(
        "CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
      );
      for (const name of files.slice(0, 3)) {
        await client.query((await content(name)).toString());
        await client.query(
          "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
          [name, await checksum(name)],
        );
      }
      const f = await seedCorePeople(client);
      existing = f.identities.orgA;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    if (!existing) throw Error("Prior fixture was not created");
    await migrateTestDatabase();
    expect(
      (
        await pool.query(
          "SELECT u.first_name,u.last_name,m.job_title,m.email_notifications_enabled FROM projectx_test.users u JOIN projectx_test.organization_memberships m ON m.user_id=u.id WHERE u.id=$1 AND m.id=$2",
          [existing.user, existing.membership],
        )
      ).rows[0],
    ).toEqual({
      first_name: null,
      last_name: null,
      job_title: null,
      email_notifications_enabled: null,
    });
    await assertMigration();
  });

  it("keeps unknown, disabled and enabled distinct under restricted RLS reads", async () => {
    const f = await freshPeopleFixture();
    const runtime = await startRuntime();
    try {
      await adminPool.query(
        "UPDATE projectx_test.users SET first_name='Ada',last_name='Lovelace' WHERE id=$1",
        [f.identities.orgA.user],
      );
      await adminPool.query(
        "UPDATE projectx_test.organization_memberships SET job_title='Host',email_notifications_enabled=false WHERE id=$1",
        [f.identities.orgA.membership],
      );
      await adminPool.query(
        "UPDATE projectx_test.organization_memberships SET email_notifications_enabled=true WHERE id=$1",
        [f.identities.a1Only.membership],
      );
      await adminPool.query(
        "INSERT INTO projectx_test.organization_memberships(id,user_id,organization_id,job_title,email_notifications_enabled) VALUES($1,$2,$3,'Other organization title',true)",
        [newPeopleId(), f.identities.orgA.user, f.orgB],
      );
      const rows = await withAuthorizedPeopleTransaction(
        runtime,
        bindVerifiedPeopleIdentity(f.identities.orgA.user),
        { organizationId: f.orgA, permissionId: "user.read" },
        async (client) =>
          (
            await client.query(
              "SELECT u.id,u.first_name,u.last_name,m.job_title,m.email_notifications_enabled FROM users u JOIN organization_memberships m ON m.user_id=u.id ORDER BY u.id",
            )
          ).rows,
      );
      expect(rows.find((x) => x.id === f.identities.orgA.user)).toMatchObject({
        first_name: "Ada",
        last_name: "Lovelace",
        job_title: "Host",
        email_notifications_enabled: false,
      });
      expect(rows.filter((x) => x.id === f.identities.orgA.user)).toHaveLength(
        1,
      );
      expect(
        rows.find((x) => x.id === f.identities.a1Only.user)
          ?.email_notifications_enabled,
      ).toBe(true);
      expect(
        rows.find((x) => x.id === f.identities.a2Only.user)
          ?.email_notifications_enabled,
      ).toBeNull();
      expect(rows.some((x) => x.id === f.identities.orgB.user)).toBe(false);
      await expect(
        runtime.query(
          "UPDATE projectx_test.users SET first_name='Illegal' WHERE id=$1",
          [f.identities.orgA.user],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await stopRuntime();
    }
  });
});
