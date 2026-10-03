import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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
import {
  bindVerifiedPeopleIdentity,
  withAuthorizedPeopleTransaction,
} from "../../src/people/authorization/context.js";
import {
  type BookedByScope,
  type BookedByName,
  addBookedByName,
  listBookedByNames,
} from "../../src/people/booked-by/service.js";
import { newPeopleId } from "../../src/people/persistence/id.js";
import { withTransaction, resetTestDatabase } from "../database/harness.js";
import { migrateTestDatabase } from "../database/migrate.js";
import { seedCorePeople } from "./fixtures/core.js";
import {
  adminPool,
  freshPeopleFixture,
  rawScoped,
  startRuntime,
  stopRuntime,
} from "./fixtures/runtime.js";

type Fixture = Awaited<ReturnType<typeof freshPeopleFixture>>;
let f: Fixture;
let runtime: Pool;
const apps: ReturnType<typeof createApp>[] = [];
const base = "/api/v1/people/booked-by-names";
const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" });
const migration = "people-zz-booked-by/20261002000700_people_booked_by.sql";
const previous = [
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
function scope(
  actor: keyof Fixture["identities"] = "orgA",
  org = f.orgA,
  venue = f.a1,
): BookedByScope {
  return {
    identity: bindVerifiedPeopleIdentity(f.identities[actor].user),
    organizationId: org,
    venueId: venue,
  };
}
function app(selected = scope()) {
  const instance = createApp(config, {
    peopleBookedBy: {
      runtimePool: runtime,
      resolveTrustedScope: async () => selected,
    },
  });
  apps.push(instance);
  return instance;
}
async function grant(
  access: string,
  org: string,
  venue: string,
  actor: string,
) {
  await adminPool.query(
    "INSERT INTO projectx_test.venue_permission_grants(id,organization_id,venue_id,venue_access_id,permission_id,granted_by_user_id) VALUES($1,$2,$3,$4,'venue.manage',$5)",
    [newPeopleId(), org, venue, access, actor],
  );
}
async function grantForeignScopes() {
  const a2Access = f.identities.a2Only.access[0];
  const b1Access = f.identities.orgB.access[0];
  if (!a2Access || !b1Access) throw new Error("Missing synthetic access");
  await grant(a2Access, f.orgA, f.a2, f.identities.orgA.user);
  await grant(b1Access, f.orgB, f.b1, f.identities.orgB.user);
}
function authorized(operation: (client: PoolClient) => Promise<unknown>) {
  const s = scope();
  return withAuthorizedPeopleTransaction(
    runtime,
    s.identity,
    {
      organizationId: s.organizationId,
      venueId: s.venueId,
      permissionId: "venue.manage",
    },
    async (client) => {
      await client.query("SELECT set_config('app.request_id',$1,true)", [
        crypto.randomUUID(),
      ]);
      return operation(client);
    },
  );
}
async function raw(
  s: BookedByScope,
  operation: (client: PoolClient) => Promise<unknown>,
) {
  const client = await runtime.connect();
  try {
    await client.query("BEGIN");
    await rawScoped(
      client,
      s.identity.userId,
      s.organizationId,
      s.venueId,
      "venue",
    );
    await client.query("SELECT set_config('app.request_id',$1,true)", [
      crypto.randomUUID(),
    ]);
    return await operation(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}
async function history(id: string) {
  return (
    await adminPool.query(
      "SELECT action,version,actor_user_id,organization_id,venue_id,request_id FROM projectx_test.booked_by_name_changes WHERE booked_by_name_id=$1 ORDER BY version",
      [id],
    )
  ).rows;
}
async function ledger() {
  return (
    await adminPool.query(
      "SELECT name,checksum FROM projectx_test.schema_migrations ORDER BY name",
    )
  ).rows;
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

describe("PEOPLE-07A venue display data and API", () => {
  it("creates, lists and saves with minimal generated DTOs and atomic attributed history", async () => {
    const instance = app();
    const created = await instance.inject({
      method: "POST",
      url: base,
      payload: { displayName: "  MiXeD <b>plain</b>  " },
    });
    expect(created.statusCode).toBe(201);
    const record = created.json<BookedByName>();
    expect(record).toEqual({
      id: expect.any(String),
      displayName: "MiXeD <b>plain</b>",
      version: 1,
    });
    const list = await instance.inject({ method: "GET", url: base });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual({ items: [record], nextCursor: null });
    const saved = await instance.inject({
      method: "PATCH",
      url: `${base}/${record.id}`,
      payload: { displayName: "  Changed  ", version: 1 },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({
      ...record,
      displayName: "Changed",
      version: 2,
    });
    const stored = (
      await adminPool.query(
        "SELECT organization_id,venue_id,created_at,updated_at FROM projectx_test.booked_by_names WHERE id=$1",
        [record.id],
      )
    ).rows[0];
    expect(stored).toMatchObject({ organization_id: f.orgA, venue_id: f.a1 });
    expect(stored.updated_at.getTime()).toBeGreaterThanOrEqual(
      stored.created_at.getTime(),
    );
    expect(await history(record.id)).toEqual(
      [1, 2].map((version) => ({
        version,
        action: version === 1 ? "CREATED" : "UPDATED",
        actor_user_id: f.identities.orgA.user,
        organization_id: f.orgA,
        venue_id: f.a1,
        request_id: expect.any(String),
      })),
    );
  });
  it("does not create identity/account rows and has only composite Venue ownership FK", async () => {
    const counts = () =>
      adminPool.query(
        "SELECT (SELECT count(*) FROM projectx_test.users) users,(SELECT count(*) FROM projectx_test.authenticated_identities) identities,(SELECT count(*) FROM projectx_test.organization_memberships) memberships,(SELECT count(*) FROM projectx_test.venue_access) accesses",
      );
    const before = (await counts()).rows;
    await addBookedByName(runtime, scope(), { displayName: "Standalone" });
    expect((await counts()).rows).toEqual(before);
    const keys = await adminPool.query(
      `SELECT n.nspname AS parent_schema,p.relname AS parent_table,
        ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum,ordinality)
          JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.ordinality) AS columns,
        ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum,ordinality)
          JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum ORDER BY k.ordinality) AS parent_columns,
        c.confdeltype AS delete_action
      FROM pg_constraint c JOIN pg_class p ON p.oid=c.confrelid JOIN pg_namespace n ON n.oid=p.relnamespace
      WHERE c.conrelid='projectx_test.booked_by_names'::regclass AND c.contype='f'`,
    );
    expect(keys.rows).toEqual([
      {
        parent_schema: "projectx_test",
        parent_table: "venues",
        columns: ["organization_id", "venue_id"],
        parent_columns: ["organization_id", "id"],
        delete_action: "r",
      },
    ]);
  });
  it("allows identical names within A1, across A1/A2 and across organizations", async () => {
    await grantForeignScopes();
    const first = await addBookedByName(runtime, scope(), {
      displayName: "Alex",
    });
    const duplicate = await addBookedByName(runtime, scope(), {
      displayName: " Alex ",
    });
    expect(
      (await addBookedByName(runtime, scope(), { displayName: "alex" }))
        .displayName,
    ).toBe("alex");
    await addBookedByName(runtime, scope("a2Only", f.orgA, f.a2), {
      displayName: "Alex",
    });
    await addBookedByName(runtime, scope("orgB", f.orgB, f.b1), {
      displayName: "Alex",
    });
    expect(first.id).not.toBe(duplicate.id);
    expect((await listBookedByNames(runtime, scope(), {})).items).toHaveLength(
      3,
    );
    expect(
      (await listBookedByNames(runtime, scope("a2Only", f.orgA, f.a2), {}))
        .items,
    ).toHaveLength(1);
    expect(
      (await listBookedByNames(runtime, scope("orgB", f.orgB, f.b1), {})).items,
    ).toHaveLength(1);
  });
  it("uses deterministic UUID ascending pagination without exposing foreign scope", async () => {
    for (const displayName of ["Z", "A", "M"])
      await addBookedByName(runtime, scope(), { displayName });
    const all = await listBookedByNames(runtime, scope(), {});
    expect(all.items.map((row) => row.id)).toEqual(
      all.items.map((row) => row.id).sort(),
    );
    const page = await listBookedByNames(runtime, scope(), { limit: 2 });
    expect(page.items).toEqual(all.items.slice(0, 2));
    expect(page.nextCursor).toBe(page.items[1]?.id);
    if (!page.nextCursor) throw new Error("Missing page cursor");
    expect(
      await listBookedByNames(runtime, scope(), {
        limit: 2,
        cursor: page.nextCursor,
      }),
    ).toEqual({ items: all.items.slice(2), nextCursor: null });
  });
  it("accepts 120 Unicode code points, trims Unicode whitespace, preserves case/plain text", async () => {
    const displayName = "😀".repeat(120);
    expect(
      (
        await addBookedByName(runtime, scope(), {
          displayName: `\u00a0${displayName}\u3000`,
        })
      ).displayName,
    ).toBe(displayName);
  });
  it.each([
    "",
    "   ",
    "a".repeat(121),
    "😀".repeat(121),
    "a\nb",
    "a\tb",
    "a\u0000b",
    "a\u007fb",
    "a\u0085b",
    "\ud800",
  ])("rejects invalid add without state/history: %j", async (displayName) => {
    const response = await app().inject({
      method: "POST",
      url: base,
      payload: { displayName },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "INVALID_REQUEST",
      message: "Invalid request",
      requestId: expect.any(String),
    });
    expect(
      (
        await adminPool.query(
          "SELECT count(*)::int n FROM projectx_test.booked_by_names",
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (
        await adminPool.query(
          "SELECT count(*)::int n FROM projectx_test.booked_by_name_changes",
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it.each(["", " ", "a".repeat(121), "bad\nname"])(
    "rejects invalid save and retains original version: %j",
    async (displayName) => {
      const record = await addBookedByName(runtime, scope(), {
        displayName: "Original",
      });
      const response = await app().inject({
        method: "PATCH",
        url: `${base}/${record.id}`,
        payload: { displayName, version: 1 },
      });
      expect(response.statusCode).toBe(400);
      expect((await listBookedByNames(runtime, scope(), {})).items).toEqual([
        record,
      ]);
      expect(await history(record.id)).toHaveLength(1);
    },
  );
  it("returns 409 for stale optimistic saves, including two concurrent writers", async () => {
    const record = await addBookedByName(runtime, scope(), {
      displayName: "Original",
    });
    const instance = app();
    const results = await Promise.all(
      ["First", "Second"].map((displayName) =>
        instance.inject({
          method: "PATCH",
          url: `${base}/${record.id}`,
          payload: { displayName, version: 1 },
        }),
      ),
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.statusCode === 409)?.json()).toEqual({
      code: "CONFLICT",
      message: "Display name version conflict",
      requestId: expect.any(String),
    });
    expect(
      (await listBookedByNames(runtime, scope(), {})).items[0]?.version,
    ).toBe(2);
    expect(await history(record.id)).toHaveLength(2);
  });
  it("rolls back state when create audit insertion fails and exposes only generic 500", async () => {
    await adminPool.query(
      "ALTER TABLE projectx_test.booked_by_name_changes ADD CONSTRAINT test_audit_failure CHECK(action='UPDATED')",
    );
    const response = await app().inject({
      method: "POST",
      url: base,
      payload: { displayName: "Not committed" },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      requestId: expect.any(String),
    });
    expect((await listBookedByNames(runtime, scope(), {})).items).toEqual([]);
  });
  it("rolls back an update and version when audit insertion fails", async () => {
    const record = await addBookedByName(runtime, scope(), {
      displayName: "Original",
    });
    await adminPool.query(
      "ALTER TABLE projectx_test.booked_by_name_changes ADD CONSTRAINT test_audit_failure CHECK(action='CREATED')",
    );
    const response = await app().inject({
      method: "PATCH",
      url: `${base}/${record.id}`,
      payload: { displayName: "Not committed", version: 1 },
    });
    expect(response.statusCode).toBe(500);
    expect((await listBookedByNames(runtime, scope(), {})).items).toEqual([
      record,
    ]);
    expect(await history(record.id)).toHaveLength(1);
  });
});

describe("PEOPLE-07A current authority and restricted runtime RLS", () => {
  it.each(["a2Only", "orgB"] as const)(
    "isolates authorized foreign %s scope and does not leak known IDs",
    async (actor) => {
      await grantForeignScopes();
      const record = await addBookedByName(runtime, scope(), {
        displayName: "A1 only",
      });
      const foreign =
        actor === "orgB"
          ? scope(actor, f.orgB, f.b1)
          : scope(actor, f.orgA, f.a2);
      const instance = app(foreign);
      const list = await instance.inject({ method: "GET", url: base });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toEqual({ items: [], nextCursor: null });
      for (const id of [record.id, newPeopleId()]) {
        const response = await instance.inject({
          method: "PATCH",
          url: `${base}/${id}`,
          payload: { displayName: "Forbidden", version: 1 },
        });
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: expect.any(String),
        });
      }
      await raw(foreign, async (client) => {
        expect(
          (
            await client.query(
              "SELECT id FROM projectx_test.booked_by_names WHERE id=$1",
              [record.id],
            )
          ).rows,
        ).toEqual([]);
        expect(
          (
            await client.query(
              "UPDATE projectx_test.booked_by_names SET display_name='Forbidden',version=version+1 WHERE id=$1",
              [record.id],
            )
          ).rowCount,
        ).toBe(0);
      });
      expect((await listBookedByNames(runtime, scope(), {})).items).toEqual([
        record,
      ]);
    },
  );
  it("does not let A2-only or ORG-B select A1 as server context", async () => {
    await grantForeignScopes();
    for (const actor of ["a2Only", "orgB"] as const) {
      const instance = app(scope(actor));
      for (const method of ["GET", "POST"] as const) {
        const response = await instance.inject({
          method,
          url: base,
          ...(method === "POST"
            ? { payload: { displayName: "Forbidden" } }
            : {}),
        });
        expect(response.statusCode).toBe(403);
      }
    }
  });
  it("requires venue.manage, not role names, user.manage or venue.read", async () => {
    const response = await app(scope("a1Only")).inject({
      method: "GET",
      url: base,
    });
    expect(response.statusCode).toBe(403);
    await adminPool.query(
      "UPDATE projectx_test.venue_role_grants SET revoked_at=now(),version=version+1 WHERE id=$1",
      [f.adminVenueGrant],
    );
    expect(
      (
        await app().inject({
          method: "POST",
          url: base,
          payload: { displayName: "Forbidden" },
        })
      ).statusCode,
    ).toBe(403);
  });
  it.each(["access", "membership", "user", "grant"])(
    "immediately denies revoked/disabled %s in API and raw RLS",
    async (kind) => {
      const record = await addBookedByName(runtime, scope(), {
        displayName: "Original",
      });
      if (kind === "access")
        await adminPool.query(
          "UPDATE projectx_test.venue_access SET revoked_at=now(),version=version+1 WHERE id=$1",
          [f.orgAdminAccess],
        );
      if (kind === "membership")
        await adminPool.query(
          "UPDATE projectx_test.organization_memberships SET revoked_at=now(),version=version+1 WHERE id=$1",
          [f.identities.orgA.membership],
        );
      if (kind === "user")
        await adminPool.query(
          "UPDATE projectx_test.users SET disabled_at=now(),version=version+1 WHERE id=$1",
          [f.identities.orgA.user],
        );
      if (kind === "grant")
        await adminPool.query(
          "UPDATE projectx_test.venue_role_grants SET revoked_at=now(),version=version+1 WHERE id=$1",
          [f.adminVenueGrant],
        );
      const instance = app();
      for (const method of ["GET", "POST", "PATCH"] as const) {
        const response = await instance.inject({
          method,
          url: method === "PATCH" ? `${base}/${record.id}` : base,
          ...(method === "GET"
            ? {}
            : {
                payload: {
                  displayName: "Forbidden",
                  ...(method === "PATCH" ? { version: 1 } : {}),
                },
              }),
        });
        expect(response.statusCode).toBe(403);
      }
      await raw(scope(), async (client) => {
        expect(
          (await client.query("SELECT id FROM projectx_test.booked_by_names"))
            .rows,
        ).toEqual([]);
        expect(
          (
            await client.query(
              "UPDATE projectx_test.booked_by_names SET display_name='Forbidden',version=version+1 WHERE id=$1",
              [record.id],
            )
          ).rowCount,
        ).toBe(0);
        await expect(
          client.query(
            "INSERT INTO projectx_test.booked_by_names(id,organization_id,venue_id,display_name) VALUES($1,$2,$3,'Forbidden')",
            [newPeopleId(), f.orgA, f.a1],
          ),
        ).rejects.toMatchObject({ code: "42501" });
      });
    },
  );
  it("uses a non-owner/non-bypass runtime, absent context hides rows and blocks writes", async () => {
    await addBookedByName(runtime, scope(), { displayName: "Private" });
    const flags = (
      await runtime.query(
        "SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    expect(flags).toEqual({
      current_user: "projectx_people_test_login",
      rolsuper: false,
      rolbypassrls: false,
    });
    expect(
      (await runtime.query("SELECT id FROM projectx_test.booked_by_names"))
        .rows,
    ).toEqual([]);
    await expect(
      runtime.query(
        "INSERT INTO projectx_test.booked_by_names(id,organization_id,venue_id,display_name) VALUES($1,$2,$3,'Forbidden')",
        [newPeopleId(), f.orgA, f.a1],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("denies raw cross-venue insert and immutable ownership update", async () => {
    await grantForeignScopes();
    await expect(
      raw(scope("a2Only", f.orgA, f.a2), (client) =>
        client.query(
          "INSERT INTO projectx_test.booked_by_names(id,organization_id,venue_id,display_name) VALUES($1,$2,$3,'Forbidden')",
          [newPeopleId(), f.orgA, f.a1],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const record = await addBookedByName(runtime, scope(), {
      displayName: "Original",
    });
    await expect(
      authorized((client) =>
        client.query(
          "UPDATE projectx_test.booked_by_names SET venue_id=$1 WHERE id=$2",
          [f.a2, record.id],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("enforces wrong organization/venue composite parent at the database boundary", async () => {
    await expect(
      withTransaction(adminPool, async (client) => {
        await client.query(
          "INSERT INTO booked_by_names(id,organization_id,venue_id,display_name) VALUES($1,$2,$3,'Wrong parent')",
          [newPeopleId(), f.orgA, f.b1],
        );
      }),
    ).rejects.toMatchObject({ code: "23503" });
  });
  it("enforces raw name validation and version preconditions", async () => {
    for (const name of [" ", "x".repeat(121), "bad\nname"]) {
      await expect(
        authorized((client) =>
          client.query(
            "INSERT INTO booked_by_names(id,organization_id,venue_id,display_name) VALUES($1,$2,$3,$4)",
            [newPeopleId(), f.orgA, f.a1, name],
          ),
        ),
      ).rejects.toMatchObject({ code: "23514" });
    }
    const record = await addBookedByName(runtime, scope(), {
      displayName: "Original",
    });
    await expect(
      authorized((client) =>
        client.query(
          "UPDATE booked_by_names SET display_name='Invalid version' WHERE id=$1",
          [record.id],
        ),
      ),
    ).rejects.toMatchObject({ code: "23514" });
    expect((await listBookedByNames(runtime, scope(), {})).items).toEqual([
      record,
    ]);
    await authorized(async (client) => {
      const name = "😀".repeat(120);
      const result = await client.query(
        "INSERT INTO booked_by_names(id,organization_id,venue_id,display_name) VALUES($1,$2,$3,$4) RETURNING display_name,version",
        [newPeopleId(), f.orgA, f.a1, `\u00a0${name}\u3000`],
      );
      expect(result.rows[0]).toEqual({ display_name: name, version: 1 });
    });
  });
  it("has no DELETE/archive or runtime audit read/write privileges", async () => {
    const record = await addBookedByName(runtime, scope(), {
      displayName: "Original",
    });
    for (const sql of [
      "DELETE FROM projectx_test.booked_by_names WHERE id=$1",
      "SELECT * FROM projectx_test.booked_by_name_changes WHERE booked_by_name_id=$1",
      "DELETE FROM projectx_test.booked_by_name_changes WHERE booked_by_name_id=$1",
    ])
      await expect(
        authorized((client) => client.query(sql, [record.id])),
      ).rejects.toMatchObject({ code: "42501" });
    expect(
      (await app().inject({ method: "DELETE", url: `${base}/${record.id}` }))
        .statusCode,
    ).toBe(404);
    for (const sql of [
      "UPDATE projectx_test.booked_by_name_changes SET action='UPDATED' WHERE booked_by_name_id=$1",
      "DELETE FROM projectx_test.booked_by_name_changes WHERE booked_by_name_id=$1",
    ])
      await expect(adminPool.query(sql, [record.id])).rejects.toMatchObject({
        code: "23514",
      });
  });
});

describe("PEOPLE-07A forward migration", () => {
  it("installs clean with exact ledger/checksum, RLS and least privilege; repeat unchanged", async () => {
    expect(await ledger()).toEqual(
      await Promise.all(
        [...previous, migration].map(async (name) => ({
          name,
          checksum: checksum(await content(name)),
        })),
      ),
    );
    const policies = (
      await adminPool.query(
        "SELECT cmd FROM pg_policies WHERE schemaname='projectx_test' AND tablename='booked_by_names' ORDER BY cmd",
      )
    ).rows;
    expect(policies).toEqual([
      { cmd: "INSERT" },
      { cmd: "SELECT" },
      { cmd: "UPDATE" },
    ]);
    expect(
      (
        await adminPool.query(
          "SELECT relrowsecurity FROM pg_class WHERE oid IN ('projectx_test.booked_by_names'::regclass,'projectx_test.booked_by_name_changes'::regclass)",
        )
      ).rows,
    ).toEqual([{ relrowsecurity: true }, { relrowsecurity: true }]);
    const rights = (
      await adminPool.query(
        "SELECT has_table_privilege('projectx_people_runtime','projectx_test.booked_by_names','SELECT') s,has_table_privilege('projectx_people_runtime','projectx_test.booked_by_names','INSERT') i,has_table_privilege('projectx_people_runtime','projectx_test.booked_by_names','UPDATE') u,has_column_privilege('projectx_people_runtime','projectx_test.booked_by_names','display_name','UPDATE') name,has_table_privilege('projectx_people_runtime','projectx_test.booked_by_names','DELETE') d,has_table_privilege('projectx_people_runtime','projectx_test.booked_by_name_changes','SELECT') audit",
      )
    ).rows[0];
    expect(rights).toEqual({
      s: true,
      i: true,
      u: false,
      name: true,
      d: false,
      audit: false,
    });
    const before = await ledger();
    await migrateTestDatabase();
    expect(await ledger()).toEqual(before);
  });
  it("upgrades all six verified migrations without changing prior rows/checksums", async () => {
    await resetTestDatabase(adminPool);
    await withTransaction(adminPool, async (client) => {
      await client.query(
        "CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
      );
      for (const name of previous) {
        const sql = await content(name);
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
          [name, checksum(sql)],
        );
      }
      await seedCorePeople(client);
    });
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
      "user_provisioning_invites",
      "organization_permission_grants",
      "venue_permission_grants",
    ];
    const snapshots = await Promise.all(
      tables.map((table) =>
        adminPool.query(`SELECT * FROM projectx_test.${table} ORDER BY 1`),
      ),
    );
    const oldLedger = await ledger();
    await migrateTestDatabase();
    expect((await ledger()).slice(0, 6)).toEqual(oldLedger);
    for (const [index, table] of tables.entries())
      expect(
        (
          await adminPool.query(
            `SELECT * FROM projectx_test.${table} ORDER BY 1`,
          )
        ).rows,
      ).toEqual(snapshots[index]?.rows);
    expect(
      (
        await adminPool.query(
          "SELECT count(*)::int n FROM projectx_test.booked_by_names",
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("rejects modified applied checksum without reapplying", async () => {
    await adminPool.query(
      "UPDATE projectx_test.schema_migrations SET checksum='tampered' WHERE name=$1",
      [migration],
    );
    await expect(migrateTestDatabase()).rejects.toThrow(
      "Modified applied migration",
    );
    expect((await ledger()).at(-1).checksum).toBe("tampered");
  });
});
