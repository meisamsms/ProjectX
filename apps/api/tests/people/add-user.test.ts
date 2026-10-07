import type { Pool } from "pg";
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
import { bindVerifiedPeopleIdentity } from "../../src/people/authorization/context.js";
import { newPeopleId } from "../../src/people/persistence/id.js";
import {
  adminPool,
  freshPeopleFixture,
  startRuntime,
  stopRuntime,
} from "./fixtures/runtime.js";

type Fixture = Awaited<ReturnType<typeof freshPeopleFixture>>;
let f: Fixture;
let runtime: Pool;
let sequence = 0;
const apps: ReturnType<typeof createApp>[] = [];
const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" });

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
  sequence += 1;
  return {
    email: `new.user.${sequence}@example.invalid`,
    firstName: "New",
    lastName: "User",
    jobTitle: "Host",
    emailNotificationsEnabled: null,
    suspended: false,
    organizationRoleIds: [f.manageRole],
    venues: [{ venueId: f.a1, roleIds: [f.venueManageRole] }],
    ...overrides,
  };
}

function post(
  instance: ReturnType<typeof createApp>,
  body: AddUserRequest | Record<string, unknown>,
  key = `people-04-key-${sequence}`,
  query = "",
) {
  return instance.inject({
    method: "POST",
    url: `/api/v1/people/accounts${query}`,
    headers: { "idempotency-key": key },
    payload: body,
  });
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
afterAll(async () => {
  await stopRuntime();
});

describe("PEOPLE-04 Add User command on real PostgreSQL", () => {
  it("installs a locked-down provisioning boundary without changing verified identity ownership", async () => {
    const columns = await adminPool.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='projectx_test' AND table_name='user_provisioning_invites' ORDER BY ordinal_position",
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      "id",
      "organization_id",
      "email",
      "normalized_email",
      "status",
      "requested_by_user_id",
      "requested_at",
      "expires_at",
      "consumed_at",
      "idempotency_key",
      "request_fingerprint",
      "user_id",
      "membership_id",
    ]);
    const security = await adminPool.query(
      `SELECT c.relrowsecurity,
        has_table_privilege('projectx_people_test_login','projectx_test.user_provisioning_invites','SELECT') can_select,
        has_table_privilege('projectx_people_test_login','projectx_test.user_provisioning_invites','INSERT') can_insert,
        has_function_privilege('projectx_people_test_login','projectx_test.create_pending_user_account(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,boolean,boolean,text,text,jsonb,jsonb)','EXECUTE') can_execute
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='projectx_test' AND c.relname='user_provisioning_invites'`,
    );
    expect(security.rows[0]).toMatchObject({
      relrowsecurity: true,
      can_select: false,
      can_insert: false,
      can_execute: true,
    });
    const identityColumns = await adminPool.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='projectx_test' AND table_name='authenticated_identities' ORDER BY ordinal_position",
    );
    expect(identityColumns.rows.map((row) => row.column_name)).toEqual([
      "id",
      "user_id",
      "issuer",
      "subject",
      "created_at",
    ]);
  });

  it("atomically creates User, membership, explicit grants, venue access and pending provisioning", async () => {
    const body = request({ email: "New.User@Example.Invalid" });
    const response = await post(app(), body);
    expect(response.statusCode).toBe(201);
    const created = response.json();
    expect(created).toMatchObject({ status: "PENDING" });
    expect(created).toEqual({
      provisioningId: expect.any(String),
      userId: expect.any(String),
      membershipId: expect.any(String),
      status: "PENDING",
    });
    const stored = await adminPool.query(
      `SELECT p.email,p.normalized_email,p.status,p.requested_by_user_id,
        u.first_name,u.last_name,u.disabled_at,
        m.job_title,m.email_notifications_enabled,
        (SELECT count(*)::int FROM projectx_test.authenticated_identities i WHERE i.user_id=u.id) identity_count,
        (SELECT count(*)::int FROM projectx_test.organization_role_grants g WHERE g.membership_id=m.id AND g.revoked_at IS NULL) org_grants,
        (SELECT count(*)::int FROM projectx_test.venue_access va WHERE va.membership_id=m.id AND va.revoked_at IS NULL) venue_accesses,
        (SELECT count(*)::int FROM projectx_test.venue_role_grants vg JOIN projectx_test.venue_access va ON va.id=vg.venue_access_id WHERE va.membership_id=m.id AND vg.revoked_at IS NULL) venue_grants
       FROM projectx_test.user_provisioning_invites p
       JOIN projectx_test.users u ON u.id=p.user_id
       JOIN projectx_test.organization_memberships m ON m.id=p.membership_id
       WHERE p.id=$1`,
      [created.provisioningId],
    );
    expect(stored.rows[0]).toMatchObject({
      email: "New.User@Example.Invalid",
      normalized_email: "new.user@example.invalid",
      status: "PENDING",
      requested_by_user_id: f.identities.orgA.user,
      first_name: "New",
      last_name: "User",
      disabled_at: null,
      job_title: "Host",
      email_notifications_enabled: null,
      identity_count: 0,
      org_grants: 1,
      venue_accesses: 1,
      venue_grants: 1,
    });
    expect(response.body).not.toMatch(
      /email|issuer|subject|permission|roleId|venueId|idempotency|fingerprint|secret|session/i,
    );
  });

  it("preserves nullable names/job title and notification null/false/true", async () => {
    for (const [index, emailNotificationsEnabled] of [
      null,
      false,
      true,
    ].entries()) {
      const response = await post(
        app(),
        request({
          email: `tri-state-${index}@example.invalid`,
          firstName: null,
          lastName: null,
          jobTitle: null,
          emailNotificationsEnabled,
          venues: [],
        }),
        `tri-state-key-${index}`,
      );
      expect(response.statusCode).toBe(201);
      const created = response.json();
      const values = await adminPool.query(
        "SELECT u.first_name,u.last_name,m.job_title,m.email_notifications_enabled FROM projectx_test.users u JOIN projectx_test.organization_memberships m ON m.user_id=u.id WHERE u.id=$1",
        [created.userId],
      );
      expect(values.rows[0]).toEqual({
        first_name: null,
        last_name: null,
        job_title: null,
        email_notifications_enabled: emailNotificationsEnabled,
      });
    }
  });

  it("maps the ProjectX suspended input only to disabled_at", async () => {
    const response = await post(
      app(),
      request({ suspended: true, venues: [] }),
    );
    expect(response.statusCode).toBe(201);
    const row = await adminPool.query(
      "SELECT disabled_at FROM projectx_test.users WHERE id=$1",
      [response.json().userId],
    );
    expect(row.rows[0]?.disabled_at).toBeInstanceOf(Date);
  });

  it("returns one logical effect for an identical idempotent retry", async () => {
    const body = request({ venues: [] });
    const key = "same-request-key";
    const first = await post(app(), body, key);
    const second = await post(app(), body, key);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());
    const counts = await adminPool.query(
      "SELECT (SELECT count(*)::int FROM projectx_test.user_provisioning_invites WHERE organization_id=$1 AND idempotency_key=$2) invites,(SELECT count(*)::int FROM projectx_test.organization_memberships WHERE user_id=$3) memberships",
      [f.orgA, key, first.json().userId],
    );
    expect(counts.rows[0]).toEqual({ invites: 1, memberships: 1 });
  });

  it("rejects conflicting idempotency reuse and duplicate pending organization email", async () => {
    const body = request({ venues: [] });
    const instance = app();
    expect((await post(instance, body, "conflict-key-1")).statusCode).toBe(201);
    const changed = await post(
      instance,
      { ...body, lastName: "Changed" },
      "conflict-key-1",
    );
    expect(changed.statusCode).toBe(409);
    const duplicate = await post(instance, body, "conflict-key-2");
    expect(duplicate.statusCode).toBe(409);
    expect(changed.body).not.toMatch(/constraint|SQL|normalized_email/i);
  });

  it("denies missing write permission, disabled actor and revoked membership", async () => {
    expect((await post(app("a1Only"), request())).statusCode).toBe(403);
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=now() WHERE id=$1",
      [f.identities.orgA.user],
    );
    expect((await post(app(), request())).statusCode).toBe(403);
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=NULL WHERE id=$1",
      [f.identities.orgA.user],
    );
    await adminPool.query(
      "UPDATE projectx_test.organization_memberships SET revoked_at=now() WHERE id=$1",
      [f.identities.orgA.membership],
    );
    expect((await post(app(), request())).statusCode).toBe(403);
  });

  it("denies cross-organization scope, unauthorized venue and wrong venue parent", async () => {
    expect((await post(app("orgA", f.orgB), request())).statusCode).toBe(403);
    expect(
      (
        await post(
          app(),
          request({
            venues: [{ venueId: f.a2, roleIds: [f.venueManageRole] }],
          }),
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await post(
          app(),
          request({
            venues: [{ venueId: f.b1, roleIds: [f.venueManageRole] }],
          }),
        )
      ).statusCode,
    ).toBe(403);
  });

  it("denies organization and venue roles whose capabilities exceed the actor", async () => {
    const forbiddenOrgRole = newPeopleId();
    const forbiddenVenueRole = newPeopleId();
    await adminPool.query(
      "INSERT INTO projectx_test.roles(id,organization_id,scope,name) VALUES($1,$3,'ORGANIZATION','Forbidden org'),($2,$3,'VENUE','Forbidden venue')",
      [forbiddenOrgRole, forbiddenVenueRole, f.orgA],
    );
    await adminPool.query(
      "INSERT INTO projectx_test.role_permissions(organization_id,role_id,role_scope,permission_id,permission_scope) VALUES($1,$2,'ORGANIZATION','organization.manage','ORGANIZATION'),($1,$3,'VENUE','reservation.cancel','VENUE')",
      [f.orgA, forbiddenOrgRole, forbiddenVenueRole],
    );
    expect(
      (
        await post(
          app(),
          request({ organizationRoleIds: [forbiddenOrgRole], venues: [] }),
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await post(
          app(),
          request({
            venues: [{ venueId: f.a1, roleIds: [forbiddenVenueRole] }],
          }),
        )
      ).statusCode,
    ).toBe(403);
  });

  it("prevents caller-selected target IDs and rejects unknown body/query fields", async () => {
    const body = request({ venues: [] });
    const instance = app();
    for (const invalid of [
      { ...body, userId: f.identities.orgA.user },
      { ...body, organizationId: f.orgB },
      { ...body, mobileMfa: true },
    ]) {
      const response = await post(instance, invalid);
      expect(response.statusCode).toBe(400);
    }
    expect(
      (await post(instance, body, "query-key-1", "?organizationId=x"))
        .statusCode,
    ).toBe(400);
    const missingDependencies = createApp(config);
    apps.push(missingDependencies);
    const unauthenticated = await post(missingDependencies, body);
    expect(unauthenticated.statusCode).toBe(401);
  });

  it("rolls back all account state when a late provisioning insert fails", async () => {
    await adminPool.query(`CREATE FUNCTION projectx_test.fail_people_provisioning() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic late failure'; END $$`);
    await adminPool.query(`CREATE TRIGGER fail_people_provisioning
      BEFORE INSERT ON projectx_test.user_provisioning_invites
      FOR EACH ROW EXECUTE FUNCTION projectx_test.fail_people_provisioning()`);
    const before = await adminPool.query(
      "SELECT (SELECT count(*)::int FROM projectx_test.users) users,(SELECT count(*)::int FROM projectx_test.organization_memberships) memberships,(SELECT count(*)::int FROM projectx_test.organization_role_grants) grants",
    );
    const response = await post(app(), request({ venues: [] }));
    expect(response.statusCode).toBe(500);
    const after = await adminPool.query(
      "SELECT (SELECT count(*)::int FROM projectx_test.users) users,(SELECT count(*)::int FROM projectx_test.organization_memberships) memberships,(SELECT count(*)::int FROM projectx_test.organization_role_grants) grants",
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(response.body).not.toContain("synthetic late failure");
  });
});
