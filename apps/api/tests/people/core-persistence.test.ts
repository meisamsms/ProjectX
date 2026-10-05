import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import {
  closeTestDatabase,
  connectTestDatabase,
  resetTestDatabase,
  withTransaction,
} from "../database/harness.js";
import { migrateTestDatabase } from "../database/migrate.js";
import { newPeopleId } from "../../src/people/persistence/id.js";
import { seedCorePeople } from "./fixtures/core.js";

const pool = connectTestDatabase();
beforeAll(async () => {
  await resetTestDatabase(pool);
  await migrateTestDatabase();
});
afterAll(async () => closeTestDatabase(pool));

async function rolledBack(fn: (client: PoolClient) => Promise<void>) {
  await expect(
    withTransaction(pool, async (client) => {
      await fn(client);
      throw new Error("fixture rollback");
    }),
  ).rejects.toThrow("fixture rollback");
}
async function rejected(
  client: PoolClient,
  sql: string,
  values: unknown[],
  code: string,
) {
  await client.query("SAVEPOINT negative_case");
  try {
    await expect(client.query(sql, values)).rejects.toMatchObject({ code });
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT negative_case");
    await client.query("RELEASE SAVEPOINT negative_case");
  }
}

describe("People core on PostgreSQL 16", () => {
  it("generates timestamped UUIDv7 with correct variant", () => {
    const time = Date.now();
    const ids = Array.from({ length: 64 }, () => newPeopleId(time));
    expect(new Set(ids).size).toBe(64);
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(Number.parseInt(id.replaceAll("-", "").slice(0, 12), 16)).toBe(
        time,
      );
    }
  });
  it("loads isolated identity, membership and single/multiple venue relationships", async () =>
    rolledBack(async (client) => {
      const f = await seedCorePeople(client);
      const counts = await client.query(
        "SELECT (SELECT count(*)::int FROM organizations) organizations, (SELECT count(*)::int FROM venues) venues, (SELECT count(*)::int FROM users) users, (SELECT count(*)::int FROM authenticated_identities) identities, (SELECT count(*)::int FROM organization_memberships) memberships, (SELECT count(*)::int FROM venue_access) access",
      );
      expect(counts.rows[0]).toMatchObject({
        organizations: 2,
        venues: 3,
        users: 8,
        identities: 8,
        memberships: 8,
        access: 8,
      });
      expect(f.identities.a1a2.access).toHaveLength(2);
      expect(f.identities.orgA.access).toHaveLength(0);
      const rows = await client.query(
        "SELECT venue_id FROM venue_access WHERE membership_id=$1",
        [f.identities.a1a2.membership],
      );
      expect(rows.rows.map((x) => x.venue_id).sort()).toEqual(
        [f.a1, f.a2].sort(),
      );
    }));
  it("rejects invalid organization, identity and foreign keys via PostgreSQL", async () =>
    rolledBack(async (client) => {
      const f = await seedCorePeople(client);
      await rejected(
        client,
        "INSERT INTO venues(id,organization_id,name) VALUES($1,$2,'invalid')",
        [newPeopleId(), newPeopleId()],
        "23503",
      );
      await rejected(
        client,
        "INSERT INTO authenticated_identities(id,user_id,issuer,subject) VALUES($1,$2,$3,$4)",
        [
          newPeopleId(),
          f.identities.orgB.user,
          "https://fixture.invalid",
          "a1Only",
        ],
        "23505",
      );
      await rejected(
        client,
        "INSERT INTO authenticated_identities(id,user_id,issuer,subject) VALUES($1,$2,$3,$4)",
        [newPeopleId(), newPeopleId(), "https://fixture.invalid", "missing"],
        "23503",
      );
      await rejected(
        client,
        "INSERT INTO organization_memberships(id,user_id,organization_id) VALUES($1,$2,$3)",
        [newPeopleId(), newPeopleId(), f.orgA],
        "23503",
      );
      await rejected(
        client,
        "INSERT INTO venue_access(id,organization_id,membership_id,venue_id) VALUES($1,$2,$3,$4)",
        [newPeopleId(), f.orgA, newPeopleId(), f.a1],
        "23503",
      );
    }));
  it("rejects duplicate active membership/access and cross-organization access", async () =>
    rolledBack(async (client) => {
      const f = await seedCorePeople(client);
      await rejected(
        client,
        "INSERT INTO organization_memberships(id,user_id,organization_id) VALUES($1,$2,$3)",
        [newPeopleId(), f.identities.a1Only.user, f.orgA],
        "23505",
      );
      await rejected(
        client,
        "INSERT INTO venue_access(id,organization_id,membership_id,venue_id) VALUES($1,$2,$3,$4)",
        [newPeopleId(), f.orgA, f.identities.a1Only.membership, f.a1],
        "23505",
      );
      await rejected(
        client,
        "INSERT INTO venue_access(id,organization_id,membership_id,venue_id) VALUES($1,$2,$3,$4)",
        [newPeopleId(), f.orgA, f.identities.a1Only.membership, f.b1],
        "23503",
      );
      await rejected(
        client,
        "INSERT INTO venue_access(id,organization_id,membership_id,venue_id) VALUES($1,$2,$3,$4)",
        [newPeopleId(), f.orgB, f.identities.a1Only.membership, f.b1],
        "23503",
      );
    }));
  it("preserves independent disabled, revoked membership and revoked venue histories", async () =>
    rolledBack(async (client) => {
      const f = await seedCorePeople(client);
      await client.query(
        "UPDATE venue_access SET revoked_at=now(), version=version+1 WHERE id=$1",
        [f.identities.a1Only.access[0]],
      );
      const activeMembership = await client.query(
        "SELECT revoked_at FROM organization_memberships WHERE id=$1",
        [f.identities.a1Only.membership],
      );
      expect(activeMembership.rows[0].revoked_at).toBeNull();
      await client.query(
        "UPDATE organization_memberships SET revoked_at=now(), version=version+1 WHERE id=$1",
        [f.identities.a2Only.membership],
      );
      expect(
        (
          await client.query("SELECT count(*)::int n FROM users WHERE id=$1", [
            f.identities.a2Only.user,
          ])
        ).rows[0].n,
      ).toBe(1);
      expect(
        (
          await client.query("SELECT disabled_at FROM users WHERE id=$1", [
            f.identities.disabledUser.user,
          ])
        ).rows[0].disabled_at,
      ).not.toBeNull();
      expect(
        (
          await client.query(
            "SELECT count(*)::int n FROM organization_memberships WHERE user_id=$1",
            [f.identities.disabledUser.user],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(
        (
          await client.query(
            "SELECT revoked_at FROM venue_access WHERE id=$1",
            [f.identities.revokedAccess.access[0]],
          )
        ).rows[0].revoked_at,
      ).not.toBeNull();
      expect(
        (
          await client.query(
            "SELECT revoked_at FROM organization_memberships WHERE id=$1",
            [f.identities.revokedMembership.membership],
          )
        ).rows[0].revoked_at,
      ).not.toBeNull();
    }));
});
