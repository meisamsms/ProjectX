import { readFile } from "node:fs/promises";
import type { components } from "@projectx/contracts/api";
import type { Pool, PoolClient } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import type { AddUserRequest } from "../../src/people/add-user/create.js";
import {
  bindVerifiedPeopleIdentity,
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
type Options = components["schemas"]["PeopleAddUserOptions"];
let f: Fixture;
let runtime: Pool;
let sequence = 0;
const apps: ReturnType<typeof createApp>[] = [];
const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" });
const organizationInsert =
  "INSERT INTO projectx_test.organization_permission_grants(id,organization_id,membership_id,permission_id,permission_scope,granted_by_user_id) VALUES($1,$2,$3,$4,$5,$6)";
const venueInsert =
  "INSERT INTO projectx_test.venue_permission_grants(id,organization_id,venue_id,venue_access_id,permission_id,granted_by_user_id) VALUES($1,$2,$3,$4,$5,$6)";
function orgGrant(
  client: Pool | PoolClient,
  membership = f.identities.a1Only.membership,
  permission = "user.read",
  scope = "ORGANIZATION",
  tenant = f.orgA,
) {
  const id = newPeopleId();
  return client
    .query(organizationInsert, [
      id,
      tenant,
      membership,
      permission,
      scope,
      f.identities.orgA.user,
    ])
    .then(() => id);
}
function venueGrant(
  client: Pool | PoolClient,
  access = f.identities.a1Only.access[0],
  permission = "venue.manage",
  venue = f.a1,
  tenant = f.orgA,
) {
  const id = newPeopleId();
  return client
    .query(venueInsert, [
      id,
      tenant,
      venue,
      access,
      permission,
      f.identities.orgA.user,
    ])
    .then(() => id);
}
async function capable(
  user: string,
  permission: string,
  venue: string | null = null,
) {
  return (
    await runtime.query(
      "SELECT projectx_test.people_has_capability($1,$2,$3,$4) allowed",
      [user, f.orgA, venue, permission],
    )
  ).rows[0].allowed;
}
function scoped(
  venue: string | null,
  operation: (client: PoolClient) => Promise<unknown>,
) {
  return withAuthorizedPeopleTransaction(
    runtime,
    bindVerifiedPeopleIdentity(f.identities.orgA.user),
    {
      organizationId: f.orgA,
      permissionId: venue ? "venue.manage" : "user.manage",
      ...(venue ? { venueId: venue } : {}),
    },
    operation,
  );
}
function app(
  actor: keyof Fixture["identities"] = "orgA",
  organizationId?: string,
) {
  const instance = createApp(config, {
    peopleAddUser: {
      runtimePool: runtime,
      resolveTrustedScope: async () => ({
        identity: bindVerifiedPeopleIdentity(f.identities[actor].user),
        organizationId: organizationId ?? f.orgA,
      }),
    },
  });
  apps.push(instance);
  return instance;
}
function request(overrides: Partial<AddUserRequest> = {}): AddUserRequest {
  return {
    email: `granular-${++sequence}@example.invalid`,
    firstName: "Direct",
    lastName: "Fixture",
    jobTitle: null,
    emailNotificationsEnabled: null,
    suspended: false,
    organizationRoleIds: [f.orgRole],
    organizationPermissionIds: ["user.manage"],
    venues: [
      {
        venueId: f.a1,
        roleIds: [f.venueManageRole],
        permissionIds: ["venue.manage"],
      },
    ],
    ...overrides,
  };
}
function post(
  instance: ReturnType<typeof createApp>,
  body: AddUserRequest | Record<string, unknown>,
  key = `granular-key-${sequence}`,
) {
  return instance.inject({
    method: "POST",
    url: "/api/v1/people/accounts",
    headers: { "idempotency-key": key },
    payload: body,
  });
}
async function options(instance = app()) {
  const response = await instance.inject({
    method: "GET",
    url: "/api/v1/people/accounts/options",
  });
  expect(response.statusCode).toBe(200);
  return response.json<Options>();
}
async function counts() {
  return (
    await adminPool.query(`SELECT (SELECT count(*) FROM projectx_test.users) users,
    (SELECT count(*) FROM projectx_test.organization_memberships) memberships,
    (SELECT count(*) FROM projectx_test.venue_access) accesses,
    (SELECT count(*) FROM projectx_test.organization_role_grants) roles,
    (SELECT count(*) FROM projectx_test.venue_role_grants) venue_roles,
    (SELECT count(*) FROM projectx_test.user_provisioning_invites) invites,
    (SELECT count(*) FROM projectx_test.organization_permission_grants) direct,
    (SELECT count(*) FROM projectx_test.venue_permission_grants) venue_direct`)
  ).rows[0];
}
beforeAll(async () => {
  f = await freshPeopleFixture();
  runtime = await startRuntime();
});
beforeEach(async () => {
  f = await freshPeopleFixture();
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((instance) => instance.close()));
});
afterAll(stopRuntime);

describe("PEOPLE-04P direct grants and effective current rights", () => {
  it("persists org/venue ownership and adds rights without changing shared roles", async () => {
    const before = (
      await adminPool.query(
        "SELECT * FROM projectx_test.role_permissions ORDER BY role_id,permission_id",
      )
    ).rows;
    await scoped(null, (client) => orgGrant(client));
    await scoped(f.a1, (client) => venueGrant(client));
    expect(await capable(f.identities.a1Only.user, "user.read")).toBe(true);
    expect(await capable(f.identities.a1Only.user, "user.read.self")).toBe(
      true,
    );
    expect(await capable(f.identities.a1Only.user, "venue.manage", f.a1)).toBe(
      true,
    );
    expect(await capable(f.identities.a1Only.user, "venue.read", f.a1)).toBe(
      true,
    );
    expect(await capable(f.identities.a1Only.user, "venue.manage", f.a2)).toBe(
      false,
    );
    expect(
      (
        await adminPool.query(
          "SELECT * FROM projectx_test.role_permissions ORDER BY role_id,permission_id",
        )
      ).rows,
    ).toEqual(before);
  });
  it("revokes direct rights immediately, preserves role rights and versions lifecycle", async () => {
    const org = await scoped(null, (client) => orgGrant(client));
    const venue = await scoped(f.a1, (client) => venueGrant(client));
    await scoped(null, async (client) => {
      await client.query(
        "UPDATE organization_permission_grants SET revoked_at=now(),version=version+1 WHERE id=$1 AND version=1",
        [org],
      );
      expect(
        (
          await client.query(
            "SELECT version,revoked_at FROM organization_permission_grants WHERE id=$1",
            [org],
          )
        ).rows[0].version,
      ).toBe(2);
      expect(
        (
          await client.query(
            "SELECT people_has_capability($1,$2,NULL,'user.read') allowed",
            [f.identities.a1Only.user, f.orgA],
          )
        ).rows[0].allowed,
      ).toBe(false);
    });
    await scoped(f.a1, async (client) => {
      await client.query(
        "UPDATE venue_permission_grants SET revoked_at=now(),version=version+1 WHERE id=$1",
        [venue],
      );
    });
    expect(await capable(f.identities.a1Only.user, "venue.manage", f.a1)).toBe(
      false,
    );
    expect(await capable(f.identities.a1Only.user, "venue.read", f.a1)).toBe(
      true,
    );
    expect(await capable(f.identities.a1Only.user, "user.read.self")).toBe(
      true,
    );
    await scoped(null, (client) => orgGrant(client)); // new active grant after historical revocation
  });
  it("prevents duplicate active org and venue grants", async () => {
    await orgGrant(adminPool);
    await venueGrant(adminPool);
    await expect(orgGrant(adminPool)).rejects.toMatchObject({ code: "23505" });
    await expect(venueGrant(adminPool)).rejects.toMatchObject({
      code: "23505",
    });
  });
  it("rejects unknown/scope mismatched canonical references", async () => {
    await expect(
      orgGrant(adminPool, undefined, "venue.manage", "VENUE"),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      orgGrant(adminPool, undefined, "user.manage", "SELF"),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      orgGrant(adminPool, undefined, "not.canonical"),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      venueGrant(adminPool, undefined, "user.manage"),
    ).rejects.toMatchObject({ code: "23503" });
  });
  it("rejects cross-org and wrong venue parents", async () => {
    await expect(
      orgGrant(adminPool, f.identities.orgB.membership),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      venueGrant(
        adminPool,
        f.identities.a1Only.access[0],
        "venue.manage",
        f.a2,
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      venueGrant(
        adminPool,
        f.identities.a1Only.access[0],
        "venue.manage",
        f.b1,
        f.orgB,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("enforces active parent insertion, immutable ownership and conditional version", async () => {
    const id = await orgGrant(adminPool);
    await expect(
      adminPool.query(
        "UPDATE projectx_test.organization_permission_grants SET permission_id='user.manage',version=version+1 WHERE id=$1",
        [id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      adminPool.query(
        "UPDATE projectx_test.organization_permission_grants SET revoked_at=now() WHERE id=$1",
        [id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await adminPool.query(
      "UPDATE projectx_test.organization_memberships SET revoked_at=now() WHERE id=$1",
      [f.identities.a1Only.membership],
    );
    await expect(
      orgGrant(adminPool, undefined, "user.manage"),
    ).rejects.toMatchObject({ code: "23514" });
    expect(await capable(f.identities.a1Only.user, "user.read")).toBe(false);
  });
  it("enforces runtime read isolation, absent context and no DELETE", async () => {
    const org = await orgGrant(adminPool);
    const venue = await venueGrant(adminPool);
    expect(
      (
        await runtime.query(
          "SELECT id FROM projectx_test.organization_permission_grants",
        )
      ).rows,
    ).toEqual([]);
    await scoped(null, async (client) => {
      expect(
        (
          await client.query(
            "SELECT id FROM organization_permission_grants WHERE id=$1",
            [org],
          )
        ).rowCount,
      ).toBe(1);
      expect(
        (
          await client.query(
            "SELECT id FROM venue_permission_grants WHERE id=$1",
            [venue],
          )
        ).rowCount,
      ).toBe(0);
    });
    await scoped(f.a1, async (client) => {
      expect(
        (
          await client.query(
            "SELECT id FROM venue_permission_grants WHERE id=$1",
            [venue],
          )
        ).rowCount,
      ).toBe(1);
    });
    await expect(
      scoped(null, async (client) => {
        await client.query(
          "DELETE FROM organization_permission_grants WHERE id=$1",
          [org],
        );
      }),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      scoped(f.a1, async (client) => {
        await client.query("DELETE FROM venue_permission_grants WHERE id=$1", [
          venue,
        ]);
      }),
    ).rejects.toMatchObject({ code: "42501" });
    const client = await runtime.connect();
    try {
      await client.query("BEGIN");
      await rawScoped(client, f.identities.orgA.user, f.orgB, f.b1, "venue");
      expect(
        (
          await client.query(
            "SELECT id FROM venue_permission_grants WHERE id=$1",
            [venue],
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await client.query(
            "UPDATE venue_permission_grants SET revoked_at=now(),version=version+1 WHERE id=$1",
            [venue],
          )
        ).rowCount,
      ).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
  it("enforces RLS subset authority and cross-venue/cross-org insert denial", async () => {
    await expect(
      scoped(null, (client) =>
        orgGrant(client, undefined, "organization.manage"),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      scoped(null, (client) =>
        orgGrant(
          client,
          f.identities.orgB.membership,
          "user.read",
          "ORGANIZATION",
          f.orgB,
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      scoped(f.a1, (client) =>
        venueGrant(client, undefined, "reservation.cancel"),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      scoped(f.a1, (client) =>
        venueGrant(client, f.identities.a2Only.access[0], "venue.manage", f.a2),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("revoking a redundant direct right leaves the same role-derived right", async () => {
    const id = await venueGrant(adminPool, undefined, "venue.read");
    await adminPool.query(
      "UPDATE projectx_test.venue_permission_grants SET revoked_at=now(),version=version+1 WHERE id=$1",
      [id],
    );
    expect(await capable(f.identities.a1Only.user, "venue.read", f.a1)).toBe(
      true,
    );
  });
  it("hides known foreign org/venue grant IDs even from a local administrator", async () => {
    const foreignOrg = await orgGrant(
      adminPool,
      f.identities.orgB.membership,
      "user.read",
      "ORGANIZATION",
      f.orgB,
    );
    const otherVenue = await venueGrant(
      adminPool,
      f.identities.a2Only.access[0],
      "venue.read",
      f.a2,
    );
    await scoped(null, async (client) => {
      expect(
        (
          await client.query(
            "SELECT id FROM organization_permission_grants WHERE id=$1",
            [foreignOrg],
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await client.query(
            "UPDATE organization_permission_grants SET revoked_at=now(),version=version+1 WHERE id=$1",
            [foreignOrg],
          )
        ).rowCount,
      ).toBe(0);
    });
    await scoped(f.a1, async (client) => {
      expect(
        (
          await client.query(
            "SELECT id FROM venue_permission_grants WHERE id=$1",
            [otherVenue],
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await client.query(
            "UPDATE venue_permission_grants SET revoked_at=now(),version=version+1 WHERE id=$1",
            [otherVenue],
          )
        ).rowCount,
      ).toBe(0);
    });
  });
  it("withdraws direct authority for disabled user, revoked membership and revoked access", async () => {
    await orgGrant(adminPool);
    await venueGrant(adminPool);
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=now() WHERE id=$1",
      [f.identities.a1Only.user],
    );
    expect(await capable(f.identities.a1Only.user, "user.read")).toBe(false);
    expect(await capable(f.identities.a1Only.user, "venue.manage", f.a1)).toBe(
      false,
    );
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=NULL WHERE id=$1",
      [f.identities.a1Only.user],
    );
    await adminPool.query(
      "UPDATE projectx_test.venue_access SET revoked_at=now() WHERE id=$1",
      [f.identities.a1Only.access[0]],
    );
    expect(await capable(f.identities.a1Only.user, "venue.manage", f.a1)).toBe(
      false,
    );
    await expect(
      venueGrant(adminPool, undefined, "venue.read"),
    ).rejects.toMatchObject({ code: "23514" });
    await adminPool.query(
      "UPDATE projectx_test.organization_memberships SET revoked_at=now() WHERE id=$1",
      [f.identities.a1Only.membership],
    );
    expect(await capable(f.identities.a1Only.user, "user.read")).toBe(false);
  });
});

describe("PEOPLE-04P Add User atomic direct grants", () => {
  it("permits assignment based on direct actor authority and removes it on revocation", async () => {
    await orgGrant(
      adminPool,
      f.identities.orgA.membership,
      "user.read.self",
      "SELF",
    );
    const actorGrant = await venueGrant(
      adminPool,
      f.orgAdminAccess,
      "reservation.read",
    );
    const body = request({
      organizationPermissionIds: ["user.read.self"],
      venues: [
        {
          venueId: f.a1,
          roleIds: [f.venueManageRole],
          permissionIds: ["reservation.read"],
        },
      ],
    });
    const response = await post(app(), body);
    expect(response.statusCode).toBe(201);
    expect(
      await capable(response.json().userId, "reservation.read", f.a1),
    ).toBe(true);
    await adminPool.query(
      "UPDATE projectx_test.venue_permission_grants SET revoked_at=now(),version=version+1 WHERE id=$1",
      [actorGrant],
    );
    expect(
      (
        await post(
          app(),
          { ...body, email: "revoked-grant@example.invalid" },
          "revoked-direct-key",
        )
      ).statusCode,
    ).toBe(403);
  });
  it("consumes authorized org/venue selections and preserves provisioning and tri-state", async () => {
    for (const emailNotificationsEnabled of [null, false, true]) {
      const response = await post(
        app(),
        request({ emailNotificationsEnabled }),
      );
      expect(response.statusCode).toBe(201);
      const created = response.json();
      expect(await capable(created.userId, "user.read")).toBe(true);
      expect(await capable(created.userId, "user.manage")).toBe(true);
      expect(await capable(created.userId, "venue.manage", f.a1)).toBe(true);
      const result = await adminPool.query(
        "SELECT m.email_notifications_enabled,p.status,p.requested_by_user_id,(SELECT count(*)::int FROM projectx_test.authenticated_identities i WHERE i.user_id=m.user_id) identities FROM projectx_test.organization_memberships m JOIN projectx_test.user_provisioning_invites p ON p.membership_id=m.id WHERE m.id=$1",
        [created.membershipId],
      );
      expect(result.rows[0]).toEqual({
        email_notifications_enabled: emailNotificationsEnabled,
        status: "PENDING",
        requested_by_user_id: f.identities.orgA.user,
        identities: 0,
      });
      expect(
        (
          await adminPool.query(
            "SELECT permission_id,granted_by_user_id FROM projectx_test.organization_permission_grants WHERE membership_id=$1",
            [created.membershipId],
          )
        ).rows,
      ).toEqual([
        {
          permission_id: "user.manage",
          granted_by_user_id: f.identities.orgA.user,
        },
      ]);
      expect(
        (
          await adminPool.query(
            "SELECT permission_id FROM projectx_test.venue_permission_grants g JOIN projectx_test.venue_access va ON va.id=g.venue_access_id WHERE va.membership_id=$1",
            [created.membershipId],
          )
        ).rows,
      ).toEqual([{ permission_id: "venue.manage" }]);
    }
  });
  it("rolls back mixed allowed/forbidden grants and scope mismatch without leaking IDs", async () => {
    const before = await counts();
    for (const body of [
      request({
        organizationPermissionIds: ["user.read", "organization.manage"],
      }),
      request({ organizationPermissionIds: ["venue.manage"] }),
      request({
        venues: [
          {
            venueId: f.a1,
            roleIds: [f.venueManageRole],
            permissionIds: ["venue.manage", "reservation.cancel"],
          },
        ],
      }),
      request({
        venues: [
          {
            venueId: f.a1,
            roleIds: [f.venueManageRole],
            permissionIds: ["user.manage"],
          },
        ],
      }),
      request({
        venues: [
          {
            venueId: f.b1,
            roleIds: [f.venueManageRole],
            permissionIds: ["venue.manage"],
          },
        ],
      }),
    ]) {
      const response = await post(app(), body);
      expect(response.statusCode).toBe(403);
      expect(response.body).not.toMatch(
        /organization.manage|reservation.cancel|constraint|SQL|projectx_test/,
      );
      expect(await counts()).toEqual(before);
    }
  });
  it("rejects arbitrary permissions, duplicates and unbound venue fields", async () => {
    const before = await counts();
    for (const body of [
      { ...request(), organizationPermissionIds: ["not.canonical"] },
      request({ organizationPermissionIds: ["user.read", "user.read"] }),
      { ...request(), venuePermissionIds: ["venue.manage"] },
      {
        ...request(),
        venues: [
          { venueId: f.a1, roleIds: [f.venueManageRole], foreignVenue: f.b1 },
        ],
      },
    ])
      expect((await post(app(), body)).statusCode).toBe(400);
    expect(await counts()).toEqual(before);
  });
  it("has one effect on retry and conflicts when permission selections change", async () => {
    const body = request();
    const first = await post(app(), body, "direct-retry-key");
    expect(first.statusCode).toBe(201);
    const before = await counts();
    expect((await post(app(), body, "direct-retry-key")).json()).toEqual(
      first.json(),
    );
    expect(await counts()).toEqual(before);
    expect(
      (
        await post(
          app(),
          { ...body, organizationPermissionIds: ["user.read"] },
          "direct-retry-key",
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await post(
          app(),
          {
            ...body,
            venues: [
              {
                venueId: f.a1,
                roleIds: [f.venueManageRole],
                permissionIds: [],
              },
            ],
          },
          "direct-retry-key",
        )
      ).statusCode,
    ).toBe(409);
    expect(await counts()).toEqual(before);
  });
  it("treats omitted and empty extensions identically for legacy role-only callers", async () => {
    const body = request({ organizationPermissionIds: [], venues: [] });
    const first = await post(app(), body, "empty-direct-key");
    const { organizationPermissionIds: _permissions, ...omitted } = body;
    expect(first.statusCode).toBe(201);
    expect((await post(app(), omitted, "empty-direct-key")).json()).toEqual(
      first.json(),
    );
  });
  it("normalizes permission ordering for retries", async () => {
    const body = request({
      organizationPermissionIds: ["user.read", "user.manage"],
    });
    const first = await post(app(), body, "sorted-direct-key");
    expect(first.statusCode).toBe(201);
    expect(
      (
        await post(
          app(),
          { ...body, organizationPermissionIds: ["user.manage", "user.read"] },
          "sorted-direct-key",
        )
      ).json(),
    ).toEqual(first.json());
  });
  it("rolls back the verified command's writes on late direct-grant failure", async () => {
    await adminPool.query(
      "CREATE FUNCTION projectx_test.fail_direct() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic direct failure'; END $$",
    );
    await adminPool.query(
      "CREATE TRIGGER fail_direct BEFORE INSERT ON projectx_test.venue_permission_grants FOR EACH ROW EXECUTE FUNCTION projectx_test.fail_direct()",
    );
    const before = await counts();
    const response = await post(app(), request());
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("synthetic");
    expect(await counts()).toEqual(before);
  });
  it("denies revoked actor venue assignment and disabled/revoked organization actor", async () => {
    await adminPool.query(
      "UPDATE projectx_test.venue_access SET revoked_at=now() WHERE id=$1",
      [f.orgAdminAccess],
    );
    expect((await post(app(), request())).statusCode).toBe(403);
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=now() WHERE id=$1",
      [f.identities.orgA.user],
    );
    expect((await post(app(), request({ venues: [] }))).statusCode).toBe(403);
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=NULL WHERE id=$1",
      [f.identities.orgA.user],
    );
    await adminPool.query(
      "UPDATE projectx_test.organization_memberships SET revoked_at=now() WHERE id=$1",
      [f.identities.orgA.membership],
    );
    expect((await post(app(), request({ venues: [] }))).statusCode).toBe(403);
  });
});

describe("PEOPLE-04P actor-specific options", () => {
  it("returns only assignable roles/venues/canonical permission subsets with minimal fields", async () => {
    const forbidden = newPeopleId();
    const foreign = newPeopleId();
    await adminPool.query(
      "INSERT INTO projectx_test.roles(id,organization_id,scope,name) VALUES($1,$3,'ORGANIZATION','Forbidden'),($2,$4,'ORGANIZATION','Foreign')",
      [forbidden, foreign, f.orgA, f.orgB],
    );
    await adminPool.query(
      "INSERT INTO projectx_test.role_permissions(organization_id,role_id,role_scope,permission_id,permission_scope) VALUES($1,$2,'ORGANIZATION','organization.manage','ORGANIZATION')",
      [f.orgA, forbidden],
    );
    const result = await options();
    expect(result.organizationRoles.map((r) => r.id).sort()).toEqual(
      [f.orgRole, f.manageRole].sort(),
    );
    expect(result.organizationPermissions.map((p) => p.id)).toEqual([
      "user.manage",
      "user.read",
    ]);
    expect(result.venues.map((v) => v.id)).toEqual([f.a1]);
    expect(result.venues[0]?.roles.map((r) => r.id)).toEqual([
      f.venueManageRole,
    ]);
    expect(result.venues[0]?.permissions.map((p) => p.id)).toEqual([
      "venue.manage",
    ]);
    const registry = JSON.parse(
      await readFile(
        new URL(
          "../../../../docs/security/permission-registry.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const allPermissions = [
      ...result.organizationPermissions,
      ...result.venues.flatMap((v) => v.permissions),
    ];
    for (const p of allPermissions) {
      expect(
        registry.permissions.some(
          (canonical: { id: string; scope: string; description: string }) =>
            canonical.id === p.id &&
            canonical.scope === p.scope &&
            canonical.description === p.description,
        ),
      ).toBe(true);
      expect(Object.keys(p).sort()).toEqual(["description", "id", "scope"]);
    }
    expect(JSON.stringify(result)).not.toMatch(
      /"(?:issuer|subject|session|risk|sql|organization_id|membership_id|revoked_at|fingerprint|password|token|secret)"\s*:/i,
    );
    expect(Object.keys(result).sort()).toEqual([
      "organizationPermissions",
      "organizationRoles",
      "venues",
    ]);
    for (const r of result.organizationRoles)
      expect(Object.keys(r).sort()).toEqual(["id", "name"]);
    for (const venue of result.venues) {
      expect(Object.keys(venue).sort()).toEqual([
        "id",
        "name",
        "permissions",
        "roles",
      ]);
      for (const role of venue.roles)
        expect(Object.keys(role).sort()).toEqual(["id", "name"]);
    }
  });
  it("includes direct capabilities, removes revoked options and honors explicit venue access", async () => {
    const org = await orgGrant(
      adminPool,
      f.identities.orgA.membership,
      "user.read.self",
      "SELF",
    );
    const venue = await venueGrant(adminPool, f.orgAdminAccess, "venue.read");
    const result = await options();
    expect(result.organizationRoles.map((r) => r.id)).toContain(f.selfRole);
    expect(result.organizationPermissions.map((p) => p.id)).toContain(
      "user.read.self",
    );
    expect(result.venues[0]?.roles.map((r) => r.id)).toContain(f.venueRole);
    expect(result.venues[0]?.permissions.map((p) => p.id)).toContain(
      "venue.read",
    );
    await adminPool.query(
      "UPDATE projectx_test.organization_permission_grants SET revoked_at=now(),version=version+1 WHERE id=$1",
      [org],
    );
    await adminPool.query(
      "UPDATE projectx_test.venue_permission_grants SET revoked_at=now(),version=version+1 WHERE id=$1",
      [venue],
    );
    const after = await options();
    expect(after.organizationRoles.map((r) => r.id)).not.toContain(f.selfRole);
    expect(after.venues[0]?.roles.map((r) => r.id)).not.toContain(f.venueRole);
    await adminPool.query(
      "UPDATE projectx_test.venue_access SET revoked_at=now() WHERE id=$1",
      [f.orgAdminAccess],
    );
    expect((await options()).venues).toEqual([]);
  });
  it("allows empty role/venue groups with a direct-authorized administrator", async () => {
    await orgGrant(adminPool, f.identities.a1Only.membership, "user.manage");
    await adminPool.query(
      "UPDATE projectx_test.organization_role_grants SET revoked_at=now() WHERE membership_id=$1",
      [f.identities.a1Only.membership],
    );
    await adminPool.query(
      "INSERT INTO projectx_test.role_permissions(organization_id,role_id,role_scope,permission_id,permission_scope) VALUES($1,$2,'ORGANIZATION','organization.manage','ORGANIZATION')",
      [f.orgA, f.manageRole],
    );
    const result = await options(app("a1Only"));
    expect(result.organizationRoles).toEqual([]);
    expect(result.organizationPermissions.map((p) => p.id)).toEqual([
      "user.manage",
    ]);
    expect(result.venues).toEqual([]);
  });
  it("denies missing capability/foreign organization/disabled/revoked actors and query injection", async () => {
    const get = (instance: ReturnType<typeof createApp>, query = "") =>
      instance.inject({
        method: "GET",
        url: `/api/v1/people/accounts/options${query}`,
      });
    expect((await get(app("a1Only"))).statusCode).toBe(403);
    expect((await get(app("orgA", f.orgB))).statusCode).toBe(403);
    expect((await get(app(), "?organizationId=foreign")).statusCode).toBe(400);
    const unauthenticated = createApp(config);
    apps.push(unauthenticated);
    expect((await get(unauthenticated)).statusCode).toBe(401);
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=now() WHERE id=$1",
      [f.identities.orgA.user],
    );
    expect((await get(app())).statusCode).toBe(403);
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=NULL WHERE id=$1",
      [f.identities.orgA.user],
    );
    await adminPool.query(
      "UPDATE projectx_test.organization_memberships SET revoked_at=now() WHERE id=$1",
      [f.identities.orgA.membership],
    );
    expect((await get(app())).statusCode).toBe(403);
  });
  it("rechecks the narrow definer boundary even when SQL context is forged", async () => {
    const client = await runtime.connect();
    try {
      await client.query("BEGIN");
      await rawScoped(
        client,
        f.identities.a1Only.user,
        f.orgA,
        null,
        "organization",
      );
      await expect(
        client.query("SELECT projectx_test.people_add_user_options()"),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
