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
const apps: ReturnType<typeof createApp>[] = [];
const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" });
function app(
  actor: keyof Fixture["identities"] = "orgA",
  organizationId?: string,
) {
  const instance = createApp(config, {
    peopleAccountsRead: {
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
const get = (instance: ReturnType<typeof createApp>, query = "") =>
  instance.inject({ method: "GET", url: `/api/v1/people/accounts${query}` });

beforeAll(async () => {
  f = await freshPeopleFixture();
  runtime = await startRuntime();
});
beforeEach(async () => {
  f = await freshPeopleFixture();
  await adminPool.query(
    "UPDATE projectx_test.users SET first_name='Ada',last_name='Lovelace' WHERE id=$1",
    [f.identities.orgA.user],
  );
  await adminPool.query(
    "UPDATE projectx_test.users SET first_name='Grace' WHERE id=$1",
    [f.identities.a1a2.user],
  );
  await adminPool.query(
    "UPDATE projectx_test.organization_memberships SET job_title='Host',email_notifications_enabled=false WHERE id=$1",
    [f.identities.orgA.membership],
  );
  await adminPool.query(
    "UPDATE projectx_test.organization_memberships SET email_notifications_enabled=true WHERE id=$1",
    [f.identities.a1Only.membership],
  );
  const manager = newPeopleId();
  await adminPool.query(
    "INSERT INTO projectx_test.roles(id,organization_id,scope,name) VALUES($1,$2,'ORGANIZATION','Manager')",
    [manager, f.orgA],
  );
  for (const membership of [
    f.identities.a1Only.membership,
    f.identities.a1a2.membership,
  ])
    await adminPool.query(
      "INSERT INTO projectx_test.organization_role_grants(id,organization_id,membership_id,role_id) VALUES($1,$2,$3,$4)",
      [newPeopleId(), f.orgA, membership, manager],
    );
  await adminPool.query(
    "INSERT INTO projectx_test.organization_role_grants(id,organization_id,membership_id,role_id) VALUES($1,$2,$3,$4)",
    [newPeopleId(), f.orgA, f.identities.a1a2.membership, f.orgRole],
  );
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((instance) => instance.close()));
});
afterAll(async () => {
  await stopRuntime();
});

describe("PEOPLE-03 authorized roster API on real PostgreSQL", () => {
  it("returns narrow persisted summaries with nullable name, job and notification tri-state", async () => {
    const response = await get(app());
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const rows = body.items as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(6);
    expect(rows.find((x) => x.id === f.identities.orgA.user)).toEqual({
      id: f.identities.orgA.user,
      name: "Ada Lovelace",
      jobTitle: "Host",
      emailNotificationsEnabled: false,
      accessLevels: ["Manage fixture", "Roster fixture"],
    });
    expect(rows.find((x) => x.id === f.identities.a1Only.user)).toMatchObject({
      name: null,
      jobTitle: null,
      emailNotificationsEnabled: true,
      accessLevels: ["Manager", "Self fixture"],
    });
    expect(rows.find((x) => x.id === f.identities.a2Only.user)).toMatchObject({
      name: null,
      jobTitle: null,
      emailNotificationsEnabled: null,
      accessLevels: [],
    });
    expect(rows.find((x) => x.id === f.identities.a1a2.user)).toMatchObject({
      name: "Grace",
      accessLevels: ["Manager", "Roster fixture"],
    });
    expect(rows.some((x) => x.id === f.identities.orgB.user)).toBe(false);
    expect(response.body).not.toMatch(
      /issuer|subject|password|session|secret|permissionId|membershipId|roleId|accessId/i,
    );
  });

  it("filters only authorized active organization-role names and returns safe empty results", async () => {
    const instance = app();
    const response = await get(instance, "?accessLevel=Manager");
    expect(response.statusCode).toBe(200);
    expect(
      response
        .json()
        .items.map((x: { id: string }) => x.id)
        .sort(),
    ).toEqual([f.identities.a1Only.user, f.identities.a1a2.user].sort());
    const empty = await get(instance, "?accessLevel=NoSuchRole");
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({ items: [], nextCursor: null });
    expect(
      (await get(instance, "?accessLevel=%27%20OR%20TRUE%20--")).json().items,
    ).toEqual([]);
    await adminPool.query(
      "UPDATE projectx_test.organization_role_grants SET revoked_at=now() WHERE role_id=(SELECT id FROM projectx_test.roles WHERE organization_id=$1 AND name='Manager')",
      [f.orgA],
    );
    expect((await get(instance, "?accessLevel=Manager")).json().items).toEqual(
      [],
    );
  });

  it("paginates in stable UUID order without unlimited enumeration", async () => {
    const instance = app();
    const first = (await get(instance, "?limit=2")).json();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBe(first.items[1].id);
    const second = (
      await get(instance, `?limit=2&cursor=${first.nextCursor}`)
    ).json();
    expect(second.items).toHaveLength(2);
    expect(first.items[1].id < second.items[0].id).toBe(true);
    const full = (await get(instance))
      .json()
      .items.map((x: { id: string }) => x.id);
    expect(full).toEqual([...full].sort());
  });

  it("denies missing trusted identity, missing user.read and a venue-only actor", async () => {
    const unavailable = createApp(config);
    apps.push(unavailable);
    expect((await get(unavailable)).statusCode).toBe(401);
    const noIdentity = createApp(config, {
      peopleAccountsRead: {
        runtimePool: runtime,
        resolveTrustedScope: async () => null,
      },
    });
    apps.push(noIdentity);
    expect((await get(noIdentity)).statusCode).toBe(401);
    const denied = await get(app("a1Only"));
    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toMatchObject({ code: "FORBIDDEN" });
    expect(denied.body).not.toContain(f.identities.orgA.user);
  });

  it("denies a disabled actor and revoked membership on the next request", async () => {
    const instance = app();
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=now() WHERE id=$1",
      [f.identities.orgA.user],
    );
    expect((await get(instance)).statusCode).toBe(403);
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=NULL WHERE id=$1",
      [f.identities.orgA.user],
    );
    await adminPool.query(
      "UPDATE projectx_test.organization_memberships SET revoked_at=now() WHERE id=$1",
      [f.identities.orgA.membership],
    );
    expect((await get(instance)).statusCode).toBe(403);
  });

  it("denies a revoked user.read grant even when the role name remains", async () => {
    const instance = app();
    await adminPool.query(
      "UPDATE projectx_test.organization_role_grants SET revoked_at=now() WHERE id=$1",
      [f.orgGrant],
    );
    const response = await get(instance);
    expect(response.statusCode).toBe(403);
    expect(response.body).not.toContain(f.identities.orgB.user);
  });

  it("never trusts query-supplied tenant IDs or exposes a known foreign ID", async () => {
    const instance = app();
    for (const q of [`?organizationId=${f.orgB}`, `?venueId=${f.b1}`]) {
      const response = await get(instance, q);
      expect(response.statusCode).toBe(400);
      expect(response.body).not.toContain(f.identities.orgB.user);
    }
    const cursor = await get(instance, `?cursor=${f.identities.orgB.user}`);
    expect(cursor.statusCode).toBe(200);
    expect(cursor.body).not.toContain(f.identities.orgB.user);
    const wrongScope = await get(app("orgA", f.orgB));
    expect(wrongScope.statusCode).toBe(403);
    expect(wrongScope.body).not.toContain(f.identities.orgB.user);
  });

  it("rejects invalid filter and pagination inputs safely", async () => {
    const instance = app();
    for (const query of [
      "?accessLevel=",
      "?accessLevel=%20%20",
      "?limit=0",
      "?limit=101",
      "?limit=bad",
      "?cursor=not-a-uuid",
      "?sort=name",
      "?search=Ada",
    ]) {
      const response = await get(instance, query);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        code: "INVALID_REQUEST",
        requestId: expect.any(String),
      });
      expect(response.body).not.toMatch(/SQL|stack|issuer|subject/i);
    }
  });
});
