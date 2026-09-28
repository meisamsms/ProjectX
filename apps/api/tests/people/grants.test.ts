import { readFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPeopleId } from "../../src/people/persistence/id.js";
import {
  closeTestDatabase,
  connectTestDatabase,
  withTransaction,
} from "../database/harness.js";
import { migrateTestDatabase } from "../database/migrate.js";
import { seedCorePeople } from "./fixtures/core.js";

const pool = connectTestDatabase();
beforeAll(() => migrateTestDatabase());
afterAll(() => closeTestDatabase(pool));
async function isolated(work: (client: PoolClient) => Promise<void>) {
  await expect(
    withTransaction(pool, async (client) => {
      await work(client);
      throw Error("rollback fixtures");
    }),
  ).rejects.toThrow("rollback fixtures");
}
async function rejected(
  client: PoolClient,
  sql: string,
  args: unknown[],
  code: string,
) {
  await client.query("SAVEPOINT negative_grant");
  try {
    await expect(client.query(sql, args)).rejects.toMatchObject({ code });
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT negative_grant");
    await client.query("RELEASE SAVEPOINT negative_grant");
  }
}
async function role(
  client: PoolClient,
  org: string,
  scope: "ORGANIZATION" | "VENUE",
  name = "Fixture role",
) {
  const id = newPeopleId();
  await client.query(
    "INSERT INTO roles(id,organization_id,scope,name) VALUES ($1,$2,$3,$4)",
    [id, org, scope, name],
  );
  return id;
}
const mapSql =
  "INSERT INTO role_permissions(organization_id,role_id,role_scope,permission_id,permission_scope) VALUES ($1,$2,$3,$4,$5)";
const orgSql =
  "INSERT INTO organization_role_grants(id,organization_id,membership_id,role_id) VALUES ($1,$2,$3,$4)";
const venueSql =
  "INSERT INTO venue_role_grants(id,organization_id,venue_id,venue_access_id,role_id) VALUES ($1,$2,$3,$4,$5)";

describe("People grants on real PostgreSQL", () => {
  it("matches all 22 authoritative permission IDs, scopes, risks and descriptions exactly", async () => {
    const registry = JSON.parse(
      await readFile(
        new URL(
          "../../../../docs/security/permission-registry.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const expected = registry.permissions
      .map(
        (p: {
          id: string;
          scope: string;
          risk: string;
          description: string;
        }) => ({
          id: p.id,
          scope: p.scope,
          risk: p.risk,
          description: p.description,
        }),
      )
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
    const { rows } = await pool.query(
      "SELECT id,scope,risk,description FROM projectx_test.permissions ORDER BY id",
    );
    expect(rows).toHaveLength(22);
    expect(
      rows.sort((a: { id: string }, b: { id: string }) =>
        a.id.localeCompare(b.id),
      ),
    ).toEqual(expected);
  });
  it("Admin name alone has no mapping or grant; explicit compatible mappings and multi-venue grants work", async () =>
    isolated(async (client) => {
      const f = await seedCorePeople(client);
      const admin = await role(client, f.orgA, "ORGANIZATION", "Admin");
      expect(
        (
          await client.query(
            "SELECT count(*)::int n FROM role_permissions WHERE role_id=$1",
            [admin],
          )
        ).rows[0].n,
      ).toBe(0);
      expect(
        (
          await client.query(
            "SELECT count(*)::int n FROM organization_role_grants WHERE role_id=$1",
            [admin],
          )
        ).rows[0].n,
      ).toBe(0);
      await client.query(mapSql, [
        f.orgA,
        admin,
        "ORGANIZATION",
        "user.read",
        "ORGANIZATION",
      ]);
      await client.query(mapSql, [
        f.orgA,
        admin,
        "ORGANIZATION",
        "user.read.self",
        "SELF",
      ]);
      await client.query(orgSql, [
        newPeopleId(),
        f.orgA,
        f.identities.orgA.membership,
        admin,
      ]);
      const venueRole = await role(client, f.orgA, "VENUE");
      await client.query(mapSql, [
        f.orgA,
        venueRole,
        "VENUE",
        "venue.read",
        "VENUE",
      ]);
      for (const [index, venue] of [f.a1, f.a2].entries())
        await client.query(venueSql, [
          newPeopleId(),
          f.orgA,
          venue,
          f.identities.a1a2.access[index],
          venueRole,
        ]);
      expect(
        (
          await client.query(
            "SELECT count(*)::int n FROM venue_role_grants WHERE role_id=$1",
            [venueRole],
          )
        ).rows[0].n,
      ).toBe(2);
    }));
  it("rejects duplicate and missing permissions, mappings, and incompatible scope", async () =>
    isolated(async (client) => {
      const f = await seedCorePeople(client);
      const orgRole = await role(client, f.orgA, "ORGANIZATION");
      const venueRole = await role(client, f.orgA, "VENUE");
      await rejected(
        client,
        "INSERT INTO permissions(id,scope,risk,description) VALUES ('user.read','ORGANIZATION','NORMAL','duplicate')",
        [],
        "23505",
      );
      await client.query(mapSql, [
        f.orgA,
        orgRole,
        "ORGANIZATION",
        "user.read",
        "ORGANIZATION",
      ]);
      await rejected(
        client,
        mapSql,
        [f.orgA, orgRole, "ORGANIZATION", "user.read", "ORGANIZATION"],
        "23505",
      );
      await rejected(
        client,
        mapSql,
        [f.orgA, orgRole, "ORGANIZATION", "missing.capability", "ORGANIZATION"],
        "23503",
      );
      await rejected(
        client,
        mapSql,
        [f.orgA, orgRole, "ORGANIZATION", "venue.read", "VENUE"],
        "23514",
      );
      await rejected(
        client,
        mapSql,
        [f.orgA, venueRole, "VENUE", "user.read", "ORGANIZATION"],
        "23514",
      );
      await rejected(
        client,
        mapSql,
        [f.orgA, venueRole, "VENUE", "user.read.self", "SELF"],
        "23514",
      );
      await rejected(
        client,
        mapSql,
        [f.orgA, venueRole, "VENUE", "venue.read", "ORGANIZATION"],
        "23503",
      );
    }));
  it("rejects cross-organization roles, wrong scope, foreign venue and duplicate grants", async () =>
    isolated(async (client) => {
      const f = await seedCorePeople(client);
      const orgRole = await role(client, f.orgA, "ORGANIZATION");
      const venueRole = await role(client, f.orgA, "VENUE");
      const otherRole = await role(client, f.orgB, "VENUE");
      await rejected(
        client,
        orgSql,
        [newPeopleId(), f.orgA, f.identities.orgB.membership, orgRole],
        "23503",
      );
      await rejected(
        client,
        orgSql,
        [newPeopleId(), f.orgA, f.identities.orgA.membership, venueRole],
        "23503",
      );
      await rejected(
        client,
        venueSql,
        [newPeopleId(), f.orgA, f.a1, f.identities.orgB.access[0], venueRole],
        "23503",
      );
      await rejected(
        client,
        venueSql,
        [newPeopleId(), f.orgA, f.a1, f.identities.a1Only.access[0], otherRole],
        "23503",
      );
      await rejected(
        client,
        venueSql,
        [newPeopleId(), f.orgA, f.a2, f.identities.a1Only.access[0], venueRole],
        "23503",
      );
      await rejected(
        client,
        venueSql,
        [newPeopleId(), f.orgA, f.a1, newPeopleId(), venueRole],
        "23503",
      );
      await client.query(orgSql, [
        newPeopleId(),
        f.orgA,
        f.identities.orgA.membership,
        orgRole,
      ]);
      await rejected(
        client,
        orgSql,
        [newPeopleId(), f.orgA, f.identities.orgA.membership, orgRole],
        "23505",
      );
      await client.query(venueSql, [
        newPeopleId(),
        f.orgA,
        f.a1,
        f.identities.a1Only.access[0],
        venueRole,
      ]);
      await rejected(
        client,
        venueSql,
        [newPeopleId(), f.orgA, f.a1, f.identities.a1Only.access[0], venueRole],
        "23505",
      );
    }));
  it("rejects new grants to revoked membership or access, including reactivation", async () =>
    isolated(async (client) => {
      const f = await seedCorePeople(client);
      const orgRole = await role(client, f.orgA, "ORGANIZATION");
      const venueRole = await role(client, f.orgA, "VENUE");
      await rejected(
        client,
        orgSql,
        [
          newPeopleId(),
          f.orgA,
          f.identities.revokedMembership.membership,
          orgRole,
        ],
        "23514",
      );
      await rejected(
        client,
        venueSql,
        [
          newPeopleId(),
          f.orgA,
          f.a1,
          f.identities.revokedAccess.access[0],
          venueRole,
        ],
        "23514",
      );
      const oid = newPeopleId();
      const vid = newPeopleId();
      await client.query(orgSql, [
        oid,
        f.orgA,
        f.identities.a1Only.membership,
        orgRole,
      ]);
      await client.query(venueSql, [
        vid,
        f.orgA,
        f.a1,
        f.identities.a1Only.access[0],
        venueRole,
      ]);
      await client.query(
        "UPDATE organization_role_grants SET revoked_at=now(),version=version+1 WHERE id=$1",
        [oid],
      );
      await client.query(
        "UPDATE venue_role_grants SET revoked_at=now(),version=version+1 WHERE id=$1",
        [vid],
      );
      await client.query(
        "UPDATE organization_memberships SET revoked_at=now() WHERE id=$1",
        [f.identities.a1Only.membership],
      );
      await client.query(
        "UPDATE venue_access SET revoked_at=now() WHERE id=$1",
        [f.identities.a1Only.access[0]],
      );
      await rejected(
        client,
        "UPDATE organization_role_grants SET revoked_at=NULL WHERE id=$1",
        [oid],
        "23514",
      );
      await rejected(
        client,
        "UPDATE venue_role_grants SET revoked_at=NULL WHERE id=$1",
        [vid],
        "23514",
      );
    }));
  it("revokes grants atomically by version without deleting role, permission or parents", async () =>
    isolated(async (client) => {
      const f = await seedCorePeople(client);
      const orgRole = await role(client, f.orgA, "ORGANIZATION");
      const venueRole = await role(client, f.orgA, "VENUE");
      const oid = newPeopleId();
      const vid = newPeopleId();
      await client.query(orgSql, [
        oid,
        f.orgA,
        f.identities.a1Only.membership,
        orgRole,
      ]);
      await client.query(venueSql, [
        vid,
        f.orgA,
        f.a1,
        f.identities.a1Only.access[0],
        venueRole,
      ]);
      for (const table of ["organization_role_grants", "venue_role_grants"]) {
        const id = table === "organization_role_grants" ? oid : vid;
        expect(
          (
            await client.query(
              `UPDATE ${table} SET revoked_at=now(),updated_at=now(),version=version+1 WHERE id=$1 AND version=1 RETURNING version,revoked_at`,
              [id],
            )
          ).rows[0],
        ).toMatchObject({ version: 2, revoked_at: expect.any(Date) });
        expect(
          (
            await client.query(
              `UPDATE ${table} SET version=version+1 WHERE id=$1 AND version=1 RETURNING id`,
              [id],
            )
          ).rowCount,
        ).toBe(0);
      }
      expect(
        (
          await client.query(
            "SELECT count(*)::int n FROM roles WHERE id IN ($1,$2)",
            [orgRole, venueRole],
          )
        ).rows[0].n,
      ).toBe(2);
      expect(
        (
          await client.query(
            "SELECT count(*)::int n FROM organization_memberships WHERE id=$1",
            [f.identities.a1Only.membership],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(
        (
          await client.query(
            "SELECT count(*)::int n FROM venue_access WHERE id=$1",
            [f.identities.a1Only.access[0]],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(
        (await client.query("SELECT count(*)::int n FROM permissions")).rows[0]
          .n,
      ).toBe(22);
    }));
});
