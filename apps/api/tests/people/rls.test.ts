import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  bindVerifiedPeopleIdentity,
  PeopleAccessDenied,
  withAuthorizedPeopleTransaction,
} from "../../src/people/authorization/context.js";
import { newPeopleId } from "../../src/people/persistence/id.js";
import {
  adminPool,
  freshPeopleFixture,
  rawScoped,
  startRuntime,
  stopRuntime,
} from "./fixtures/runtime.js";

type Fixture = Awaited<ReturnType<typeof freshPeopleFixture>>;
let runtime: Pool;
let f: Fixture;
beforeAll(async () => {
  f = await freshPeopleFixture();
  runtime = await startRuntime();
});
beforeEach(async () => {
  f = await freshPeopleFixture();
});
afterAll(async () => {
  await stopRuntime();
});
const scope = <T>(
  key: keyof Fixture["identities"],
  capability: string,
  operation: (client: PoolClient) => Promise<T>,
  venueId?: string,
) =>
  withAuthorizedPeopleTransaction(
    runtime,
    bindVerifiedPeopleIdentity(f.identities[key].user),
    {
      organizationId: f.orgA,
      permissionId: capability,
      ...(venueId ? { venueId } : {}),
    },
    operation,
  );
async function raw<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await runtime.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL search_path TO projectx_test, public");
    const v = await work(client);
    await client.query("COMMIT");
    return v;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function rejected(
  client: PoolClient,
  sql: string,
  args: unknown[],
  code: string,
) {
  await client.query("SAVEPOINT rls_negative");
  try {
    await expect(client.query(sql, args)).rejects.toMatchObject({ code });
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT rls_negative");
    await client.query("RELEASE SAVEPOINT rls_negative");
  }
}

describe("People RLS under restricted PostgreSQL runtime login", () => {
  it("has neither BYPASSRLS nor schema ownership, DDL, superuser or owner role switching", async () => {
    const flags = await runtime.query(
      "SELECT current_user, r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb FROM pg_roles r WHERE r.rolname=current_user",
    );
    expect(flags.rows[0]).toMatchObject({
      rolsuper: false,
      rolbypassrls: false,
      rolcreaterole: false,
      rolcreatedb: false,
    });
    expect(
      (
        await runtime.query(
          "SELECT has_schema_privilege(current_user,'projectx_test','CREATE') allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    expect(
      (
        await runtime.query(
          "SELECT pg_get_userbyid(relowner) owner FROM pg_class WHERE oid='projectx_test.roles'::regclass",
        )
      ).rows[0].owner,
    ).not.toBe(flags.rows[0].current_user);
    await expect(
      runtime.query("CREATE TABLE projectx_test.runtime_illegal(id int)"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      runtime.query("SET ROLE projectx_people_runtime"),
    ).resolves.toBeDefined(); // narrow inherited role only
    await runtime.query("RESET ROLE");
    const owner = (
      await adminPool.query(
        "SELECT pg_get_userbyid(relowner) owner FROM pg_class WHERE oid='projectx_test.roles'::regclass",
      )
    ).rows[0].owner;
    await expect(runtime.query(`SET ROLE ${owner}`)).rejects.toMatchObject({
      code: "42501",
    });
  });
  it("fails closed with missing, malformed or organization-only venue context", async () => {
    expect(
      (
        await runtime.query(
          "SELECT count(*)::int n FROM projectx_test.organization_memberships",
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (
        await runtime.query(
          "SELECT count(*)::int n FROM projectx_test.venue_access",
        )
      ).rows[0].n,
    ).toBe(0);
    await raw(async (client) => {
      await rawScoped(
        client,
        f.identities.a1Only.user,
        f.orgA,
        null,
        "organization",
      );
      expect(
        (await client.query("SELECT count(*)::int n FROM venue_access")).rows[0]
          .n,
      ).toBe(0);
      await client.query(
        "SELECT set_config('app.organization_id','malformed',true)",
      );
      expect(
        (
          await client.query(
            "SELECT count(*)::int n FROM organization_memberships",
          )
        ).rows[0].n,
      ).toBe(0);
    });
  });
  it("isolates organization and known foreign User IDs", async () => {
    const ids = await scope("orgA", "user.read", async (client) =>
      (await client.query("SELECT id FROM users ORDER BY id")).rows.map(
        (x) => x.id,
      ),
    );
    expect(ids).toContain(f.identities.orgA.user);
    expect(ids).not.toContain(f.identities.orgB.user);
    await expect(
      withAuthorizedPeopleTransaction(
        runtime,
        bindVerifiedPeopleIdentity(f.identities.orgA.user),
        {
          organizationId: f.orgA,
          permissionId: "user.read",
          target: { kind: "user", id: f.identities.orgB.user },
        },
        async () => true,
      ),
    ).rejects.toBeInstanceOf(PeopleAccessDenied);
  });
  it("isolates A1 from A2 even inside ORG-A", async () => {
    const ids = await scope(
      "a1Only",
      "venue.read",
      async (client) =>
        (await client.query("SELECT venue_id FROM venue_access")).rows.map(
          (x) => x.venue_id,
        ),
      f.a1,
    );
    expect(ids).toContain(f.a1);
    expect(ids).not.toContain(f.a2);
    await expect(
      scope(
        "a1Only",
        "venue.read",
        async (client) =>
          client.query("SELECT id FROM venues WHERE id=$1", [f.a2]),
        f.a2,
      ),
    ).rejects.toBeInstanceOf(PeopleAccessDenied);
  });
  it("enforces INSERT WITH CHECK and UPDATE scope move for organization records", async () => {
    await scope("orgA", "user.manage", async (client) => {
      await rejected(
        client,
        "INSERT INTO roles(id,organization_id,scope,name) VALUES($1,$2,'ORGANIZATION','foreign')",
        [newPeopleId(), f.orgB],
        "42501",
      );
      const fresh = newPeopleId();
      await client.query(
        "INSERT INTO roles(id,organization_id,scope,name) VALUES($1,$2,'ORGANIZATION','local')",
        [fresh, f.orgA],
      );
      await rejected(
        client,
        "UPDATE roles SET organization_id=$1 WHERE id=$2",
        [f.orgB, fresh],
        "42501",
      );
    });
  });
  it("rejects wrong Venue INSERT and A1 to A2 scope move", async () => {
    await scope(
      "orgA",
      "venue.manage",
      async (client) => {
        await rejected(
          client,
          "INSERT INTO roles(id,organization_id,scope,name) VALUES($1,$2,'VENUE','foreign')",
          [newPeopleId(), f.orgB],
          "42501",
        );
        await rejected(
          client,
          "INSERT INTO venue_role_grants(id,organization_id,venue_id,venue_access_id,role_id) VALUES($1,$2,$3,$4,$5)",
          [
            newPeopleId(),
            f.orgA,
            f.a2,
            f.identities.a1a2.access[1],
            f.venueManageRole,
          ],
          "42501",
        );
      },
      f.a1,
    );
  });
  it("denies physical DELETE and keeps lifecycle records", async () => {
    await scope("orgA", "user.manage", async (client) => {
      await rejected(
        client,
        "DELETE FROM organization_role_grants WHERE id=$1",
        [f.orgGrant],
        "42501",
      );
    });
    expect(
      (
        await adminPool.query(
          "SELECT count(*)::int n FROM projectx_test.organization_role_grants WHERE id=$1",
          [f.orgGrant],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("clears context after COMMIT, ROLLBACK and a failed query on the reused pool connection", async () => {
    await scope("orgA", "user.read", async (client) => {
      expect(
        (
          await client.query(
            "SELECT current_setting('app.organization_id',true) id",
          )
        ).rows[0].id,
      ).toBe(f.orgA);
    });
    expect(
      (
        await runtime.query(
          "SELECT nullif(current_setting('app.organization_id',true),'') id",
        )
      ).rows[0].id,
    ).toBeNull();
    await expect(
      scope("orgA", "user.read", async (client) => {
        await client.query("SELECT 1/0");
        return true;
      }),
    ).rejects.toMatchObject({ code: "22012" });
    expect(
      (await runtime.query("SELECT count(*)::int n FROM projectx_test.roles"))
        .rows[0].n,
    ).toBe(0);
    await raw(async (client) => {
      await rawScoped(
        client,
        f.identities.orgB.user,
        f.orgB,
        null,
        "organization",
      );
      expect(
        (await client.query("SELECT count(*)::int n FROM roles")).rows[0].n,
      ).toBe(0);
    });
    expect(
      (
        await runtime.query(
          "SELECT nullif(current_setting('app.organization_id',true),'') id",
        )
      ).rows[0].id,
    ).toBeNull();
    const own = await scope(
      "orgA",
      "user.read",
      async (client) =>
        (await client.query("SELECT count(*)::int n FROM roles")).rows[0].n,
    );
    expect(own).toBeGreaterThan(0);
  });
});
