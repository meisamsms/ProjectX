import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { postgresStaffStore } from "../../src/staff-auth/store.js";
import {
  hash,
  secret,
  SESSION_COOKIE,
} from "../../src/staff-auth/credentials.js";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createStaffRuntimePool } from "../../src/staff-auth/runtime.js";
import {
  bindVerifiedPeopleIdentity,
  withAuthorizedPeopleTransaction,
} from "../../src/people/authorization/context.js";
import {
  adminPool,
  freshPeopleFixture,
  startRuntime,
  stopRuntime,
} from "../people/fixtures/runtime.js";
import { migrateTestDatabase } from "../database/migrate.js";
import { config } from "./fixtures.js";

let runtime: Pool;
let fixture: Awaited<ReturnType<typeof freshPeopleFixture>>;
let store: ReturnType<typeof postgresStaffStore>;
beforeAll(async () => {
  await freshPeopleFixture();
  runtime = await startRuntime();
  await adminPool.query(
    "GRANT projectx_staff_auth_runtime TO projectx_people_test_login",
  );
  store = postgresStaffStore(runtime);
});
beforeEach(async () => {
  fixture = await freshPeopleFixture();
});
afterAll(async () => {
  await stopRuntime();
});
async function issue(subject = "orgA") {
  const credential = secret();
  const result = await store.issue(
    { issuer: "https://fixture.invalid", subject, authenticatedAt: null },
    hash(credential),
    null,
  );
  if (!result || "denial" in result) throw Error("Fixture issuance failed");
  return { credential, h: hash(credential), session: result };
}
describe("CORE-AUTH-02 real PostgreSQL 16 auth seam", () => {
  it("actual HTTP cookie resolver reaches current People/RLS and denies next request after revocation", async () => {
    const { credential } = await issue();
    const app = createApp(
      loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" }),
      {
        staffAuth: {
          config,
          store,
          runtimePool: runtime,
          oidc: {
            authorize: async () => {
              throw Error();
            },
            callback: async () => {
              throw Error();
            },
          },
        },
      },
    );
    const headers = {
      host: "app.test",
      cookie: `${SESSION_COOKIE}=${credential}`,
      "x-user-id": fixture.identities.orgB.user,
    };
    try {
      const response = await app.inject({
        url: "/api/v1/people/accounts",
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain(fixture.identities.orgB.user);
      await adminPool.query(
        "UPDATE projectx_test.organization_role_grants SET revoked_at=now() WHERE id=$1",
        [fixture.orgGrant],
      );
      expect(
        (await app.inject({ url: "/api/v1/people/accounts", headers }))
          .statusCode,
      ).toBe(403);
    } finally {
      await app.close();
    }
  });
  it("upgrade from populated predecessor schema preserves existing People data and historical ledger", async () => {
    const before = (
      await adminPool.query(
        "SELECT name,checksum FROM projectx_test.schema_migrations WHERE name NOT LIKE 'staff-auth/%' ORDER BY name",
      )
    ).rows;
    // Only the new seam is removed, in the isolated resettable test schema.
    await adminPool.query(
      "DROP FUNCTION projectx_test.staff_login_start(text,text,text,text), projectx_test.staff_login_consume(text), projectx_test.staff_session_read(text,boolean), projectx_test.staff_session_issue(text,text,text,text,timestamptz), projectx_test.staff_session_switch(text,uuid,uuid,integer), projectx_test.staff_session_revoke(text), projectx_test.staff_own_contexts(uuid)",
    );
    await adminPool.query(
      "DROP TABLE projectx_test.staff_sessions,projectx_test.staff_login_transactions",
    );
    await adminPool.query(
      "DELETE FROM projectx_test.schema_migrations WHERE name LIKE 'staff-auth/%'",
    );
    const users = (
      await adminPool.query("SELECT id FROM projectx_test.users ORDER BY id")
    ).rows;
    await migrateTestDatabase();
    expect(
      (await adminPool.query("SELECT id FROM projectx_test.users ORDER BY id"))
        .rows,
    ).toEqual(users);
    expect(
      (
        await adminPool.query(
          "SELECT name,checksum FROM projectx_test.schema_migrations WHERE name NOT LIKE 'staff-auth/%' ORDER BY name",
        )
      ).rows,
    ).toEqual(before);
    expect((await issue()).session.userId).toBe(fixture.identities.orgA.user);
  });
  it("new migration has repeatable ledger and RLS/default-deny auth tables", async () => {
    await migrateTestDatabase();
    const entries = await adminPool.query(
      "SELECT name FROM projectx_test.schema_migrations WHERE name LIKE 'staff-auth/%'",
    );
    expect(entries.rowCount).toBe(1);
    const flags = await runtime.query(
      "SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='projectx_test' AND c.relname IN ('staff_sessions','staff_login_transactions')",
    );
    expect(flags.rows).toHaveLength(2);
    expect(flags.rows.every((x) => x.relrowsecurity)).toBe(true);
  });
  it("AUTH-N34 no direct auth table reads/writes or arbitrary actor context function", async () => {
    for (const table of ["staff_sessions", "staff_login_transactions"]) {
      await expect(
        runtime.query(`SELECT * FROM projectx_test.${table}`),
      ).rejects.toMatchObject({ code: "42501" });
      const acl = await runtime.query(
        "SELECT has_table_privilege(current_user,$1,'INSERT,UPDATE,DELETE') allowed",
        [`projectx_test.${table}`],
      );
      expect(acl.rows[0].allowed).toBe(false);
    }
    await expect(
      runtime.query("SELECT projectx_test.staff_own_contexts($1)", [
        fixture.identities.orgA.user,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    const publicAcl = await adminPool.query(
      "SELECT count(*)::integer n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='projectx_test' AND p.proname LIKE 'staff_%' AND a.grantee=0 AND a.privilege_type='EXECUTE'",
    );
    expect(publicAcl.rows[0].n).toBe(0);
    const funcs = await adminPool.query(
      "SELECT proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='projectx_test' AND p.proname LIKE 'staff_%'",
    );
    expect(
      funcs.rows.every((x) =>
        x.proconfig.includes("search_path=pg_catalog, projectx_test, pg_temp"),
      ),
    ).toBe(true);
  });
  it("AUTH-N34 temp-table shadows cannot impersonate User or session", async () => {
    await runtime.query(
      "CREATE TEMP TABLE staff_sessions(token_hash text,user_id uuid)",
    );
    const h = hash(secret());
    await runtime.query("INSERT INTO staff_sessions VALUES($1,$2)", [
      h,
      fixture.identities.orgA.user,
    ]);
    expect(await store.read(h, false)).toBeNull();
    await runtime.query("DROP TABLE staff_sessions");
  });
  it("AUTH-N20/22 single-use transaction across independent DB connections", async () => {
    const h = hash(secret()),
      t = { state: secret(), nonce: secret(), verifier: secret() };
    await store.startLogin(h, t);
    const other = new Pool({
      connectionString: runtime.options.connectionString,
      max: 2,
    });
    try {
      const second = postgresStaffStore(other);
      const results = await Promise.all([
        store.consumeLogin(h),
        second.consumeLogin(h),
      ]);
      expect(results.filter(Boolean)).toEqual([t]);
      expect(await second.consumeLogin(h)).toBeNull();
    } finally {
      await other.end();
    }
  });
  it("AUTH-N20 transaction expires and malformed arguments cannot write", async () => {
    const h = hash(secret()),
      t = { state: secret(), nonce: secret(), verifier: secret() };
    await store.startLogin(h, t);
    await adminPool.query(
      "UPDATE projectx_test.staff_login_transactions SET expires_at=now()-interval '1 second'",
    );
    expect(await store.consumeLogin(h)).toBeNull();
    await expect(store.startLogin("bad-hash", t)).rejects.toMatchObject({
      code: "22023",
    });
  });
  it("session stores only verifier, exact linked binding and approved lifetime; no provider tokens", async () => {
    const { credential, h, session } = await issue();
    expect(session.organizationId).toBe(fixture.orgA);
    expect(session.venueId).toBe(fixture.a1);
    const stored = await adminPool.query(
      "SELECT *,extract(epoch from absolute_expires_at-created_at)::integer duration FROM projectx_test.staff_sessions WHERE token_hash=$1",
      [h],
    );
    expect(stored.rows[0].duration).toBeGreaterThanOrEqual(43200);
    expect(stored.rows[0].duration).toBeLessThan(43202);
    expect(JSON.stringify(stored.rows)).not.toContain(credential);
    expect(JSON.stringify(stored.rows)).not.toMatch(
      /access_token|id_token|refresh_token/,
    );
  });
  it("AUTH-N02 forged hash never resolves or leaks identity", async () => {
    expect(await store.read(hash(secret()), false)).toBeNull();
  });
  it.each(["absolute", "idle"])(
    "AUTH-N03 %s expiry denies without renewal",
    async (mode) => {
      const { h } = await issue();
      await adminPool.query(
        mode === "absolute"
          ? "UPDATE projectx_test.staff_sessions SET absolute_expires_at=now()-interval '1 second' WHERE token_hash=$1"
          : "UPDATE projectx_test.staff_sessions SET last_activity_at=now()-interval '30 minutes' WHERE token_hash=$1",
        [h],
      );
      expect(await store.read(h, true)).toBeNull();
      expect(await store.read(h, false)).toBeNull();
    },
  );
  it("AUTH-N03 GET polling cannot extend idle activity; interactive request cannot extend absolute expiry", async () => {
    const { h } = await issue();
    await adminPool.query(
      "UPDATE projectx_test.staff_sessions SET last_activity_at=now()-interval '10 minutes' WHERE token_hash=$1",
      [h],
    );
    const before = await adminPool.query(
      "SELECT last_activity_at,absolute_expires_at FROM projectx_test.staff_sessions WHERE token_hash=$1",
      [h],
    );
    await store.read(h, false);
    const poll = await adminPool.query(
      "SELECT last_activity_at FROM projectx_test.staff_sessions WHERE token_hash=$1",
      [h],
    );
    expect(poll.rows[0].last_activity_at).toEqual(
      before.rows[0].last_activity_at,
    );
    await store.read(h, true);
    const after = await adminPool.query(
      "SELECT last_activity_at,absolute_expires_at FROM projectx_test.staff_sessions WHERE token_hash=$1",
      [h],
    );
    expect(after.rows[0].last_activity_at.getTime()).toBeGreaterThan(
      before.rows[0].last_activity_at.getTime(),
    );
    expect(after.rows[0].absolute_expires_at).toEqual(
      before.rows[0].absolute_expires_at,
    );
  });
  it("AUTH-N04/25 durable revoke/logout prevents reuse", async () => {
    const { h } = await issue();
    await store.revoke(h);
    await store.revoke(h);
    expect(await store.read(h, true)).toBeNull();
  });
  it("AUTH-N05 disabled User invalidates sessions after current-state change", async () => {
    const { h } = await issue();
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=now() WHERE id=$1",
      [fixture.identities.orgA.user],
    );
    expect(await store.read(h, false)).toEqual({ denial: "DISABLED" });
    expect(await store.read(h, false)).toBeNull();
  });
  it("AUTH-N06 revoked membership clears both context IDs without Venue fallback", async () => {
    const { h } = await issue();
    await adminPool.query(
      "UPDATE projectx_test.organization_memberships SET revoked_at=now() WHERE id=$1",
      [fixture.identities.orgA.membership],
    );
    expect(await store.read(h, false)).toMatchObject({
      organizationId: null,
      venueId: null,
      contextVersion: 2,
      contexts: [],
    });
  });
  it("AUTH-N07/14 revoked access clears only selected Venue, no silent write retarget", async () => {
    const { h } = await issue();
    await adminPool.query(
      "UPDATE projectx_test.venue_access SET revoked_at=now() WHERE id=$1",
      [fixture.orgAdminAccess],
    );
    expect(await store.read(h, false)).toMatchObject({
      organizationId: fixture.orgA,
      venueId: null,
      contextVersion: 2,
    });
  });
  it("no/one/many Venue states enumerate only this actor's active choices", async () => {
    const one = await issue("a1Only");
    expect(one.session.venueId).toBe(fixture.a1);
    const many = await issue("a1a2");
    expect(many.session.venueId).toBeNull();
    expect(many.session.contexts).toHaveLength(2);
    const none = await issue("revokedAccess");
    expect(none.session.venueId).toBeNull();
    expect(none.session.contexts).toEqual([
      { organizationId: fixture.orgA, venueId: null },
    ]);
    expect(JSON.stringify(many.session.contexts)).not.toContain(fixture.b1);
  });
  it("AUTH-N10/11/12/13 invalid/cross-org contexts return identical denial and retain prior valid selection", async () => {
    const { h, session } = await issue();
    for (const [org, venue] of [
      [fixture.orgB, fixture.b1],
      [fixture.orgA, fixture.b1],
      [fixture.orgA, randomUUID()],
    ] as const)
      expect(await store.switch(h, org, venue, 1)).toEqual({
        denial: "CONTEXT",
      });
    expect(await store.read(h, false)).toEqual(session);
  });
  it("AUTH-N31 context version rejects stale tab even after valid switch", async () => {
    const { h } = await issue("a1a2");
    expect(await store.switch(h, fixture.orgA, fixture.a1, 1)).toMatchObject({
      venueId: fixture.a1,
      contextVersion: 2,
    });
    expect(await store.switch(h, fixture.orgA, fixture.a2, 1)).toEqual({
      denial: "STALE",
    });
    expect(await store.read(h, false)).toMatchObject({ venueId: fixture.a1 });
  });
  it("AUTH-N26 rotation invalidates predecessor but preserves independent device sessions", async () => {
    const old = await issue(),
      other = await issue(),
      h = hash(secret());
    const rotated = await store.issue(
      {
        issuer: "https://fixture.invalid",
        subject: "orgA",
        authenticatedAt: null,
      },
      h,
      old.h,
    );
    expect(rotated).not.toBeNull();
    expect(await store.read(old.h, false)).toBeNull();
    expect(await store.read(other.h, false)).not.toBeNull();
  });
  it("AUTH-N27 unknown/exact-case identity does not auto-link, create User, or grant access", async () => {
    const before = await adminPool.query(
      "SELECT count(*) FROM projectx_test.users",
    );
    for (const subject of ["unknown", "OrgA", " orgA"])
      expect(
        await store.issue(
          { issuer: "https://fixture.invalid", subject, authenticatedAt: null },
          hash(secret()),
          null,
        ),
      ).toBeNull();
    expect(
      await store.issue(
        {
          issuer: "https://fixture.invalid/",
          subject: "orgA",
          authenticatedAt: null,
        },
        hash(secret()),
        null,
      ),
    ).toBeNull();
    expect(
      (await adminPool.query("SELECT count(*) FROM projectx_test.users")).rows,
    ).toEqual(before.rows);
    await expect(
      adminPool.query(
        "INSERT INTO projectx_test.authenticated_identities(id,user_id,issuer,subject) VALUES($1,$2,'https://fixture.invalid','orgA')",
        [randomUUID(), fixture.identities.orgA.user],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
  it.each(["removed", "rebound"])(
    "AUTH-N28 %s mapping invalidates existing session",
    async (mode) => {
      const { h } = await issue();
      await adminPool.query(
        mode === "removed"
          ? "DELETE FROM projectx_test.authenticated_identities WHERE subject='orgA'"
          : "UPDATE projectx_test.authenticated_identities SET user_id=$1 WHERE subject='orgA'",
        mode === "removed" ? [] : [fixture.identities.orgB.user],
      );
      expect(await store.read(h, false)).toBeNull();
    },
  );
  it("AUTH-N08/29 existing role/direct capability revocation is checked at protected-operation time", async () => {
    const { session } = await issue();
    const scope = { organizationId: fixture.orgA, permissionId: "user.read" };
    const identity = bindVerifiedPeopleIdentity(session.userId);
    await expect(
      withAuthorizedPeopleTransaction(
        runtime,
        identity,
        scope,
        async () => true,
      ),
    ).resolves.toBe(true);
    await adminPool.query(
      "UPDATE projectx_test.organization_role_grants SET revoked_at=now() WHERE id=$1",
      [fixture.orgGrant],
    );
    await expect(
      withAuthorizedPeopleTransaction(runtime, identity, scope, async () => {
        throw Error("Unauthorized callback");
      }),
    ).rejects.toThrow("People access denied");
  });
  it("AUTH-N15 fresh transaction context and raw pooled cleanup after success/denial/org-only", async () => {
    const identity = bindVerifiedPeopleIdentity(fixture.identities.orgA.user);
    await withAuthorizedPeopleTransaction(
      runtime,
      identity,
      {
        organizationId: fixture.orgA,
        venueId: fixture.a1,
        permissionId: "venue.manage",
      },
      async (c) => {
        expect(
          (await c.query("SELECT current_setting('app.venue_id',true) venue"))
            .rows[0].venue,
        ).toBe(fixture.a1);
      },
    );
    await withAuthorizedPeopleTransaction(
      runtime,
      identity,
      { organizationId: fixture.orgA, permissionId: "user.read" },
      async (c) => {
        expect(
          (await c.query("SELECT current_setting('app.venue_id',true) venue"))
            .rows[0].venue,
        ).toBe("");
      },
    );
    await expect(
      withAuthorizedPeopleTransaction(
        runtime,
        identity,
        { organizationId: fixture.orgB, permissionId: "user.read" },
        async () => false,
      ),
    ).rejects.toThrow();
    const raw = await runtime.query(
      "SELECT current_setting('app.user_id',true) actor,current_setting('app.organization_id',true) org,current_setting('app.venue_id',true) venue",
    );
    expect(raw.rows[0]).toEqual({ actor: "", org: "", venue: "" });
  });
  it("restricted startup accepts non-owner scoped login and refuses migration owner", async () => {
    const good = await createStaffRuntimePool({
      ...config,
      runtimeDatabaseUrl: runtime.options.connectionString ?? "",
    });
    await good.end();
    await expect(
      createStaffRuntimePool({
        ...config,
        runtimeDatabaseUrl: process.env.DATABASE_URL ?? "",
      }),
    ).rejects.toThrow("Restricted staff database configuration required");
  });
  it("AUTH-N34 startup rejects an indirectly assumable BYPASSRLS role", async () => {
    await adminPool.query(
      "CREATE ROLE projectx_auth_test_unsafe NOLOGIN BYPASSRLS",
    );
    try {
      await adminPool.query(
        "GRANT projectx_auth_test_unsafe TO projectx_people_test_login",
      );
      await expect(
        createStaffRuntimePool({
          ...config,
          runtimeDatabaseUrl: runtime.options.connectionString ?? "",
        }),
      ).rejects.toThrow("Restricted staff database configuration required");
    } finally {
      await adminPool.query(
        "REVOKE projectx_auth_test_unsafe FROM projectx_people_test_login",
      );
      await adminPool.query("DROP ROLE projectx_auth_test_unsafe");
    }
  });
});
