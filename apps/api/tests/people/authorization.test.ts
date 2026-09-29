import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  bindVerifiedPeopleIdentity,
  PeopleAccessDenied,
  withAuthorizedPeopleTransaction,
} from "../../src/people/authorization/context.js";
import {
  adminPool,
  freshPeopleFixture,
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
const actor = (key: keyof Fixture["identities"]) =>
  bindVerifiedPeopleIdentity(f.identities[key].user);
const attempt = (
  key: keyof Fixture["identities"],
  organizationId: string,
  permissionId: string,
  venueId?: string,
  target?: {
    kind: "user" | "membership" | "venueAccess" | "role" | "venue";
    id: string;
  },
) =>
  withAuthorizedPeopleTransaction(
    runtime,
    actor(key),
    {
      organizationId,
      permissionId,
      ...(venueId ? { venueId } : {}),
      ...(target ? { target } : {}),
    },
    async (client) =>
      (
        await client.query(
          "SELECT current_setting('app.access_mode',true) mode",
        )
      ).rows[0]?.mode,
  );

describe("People server authorization on PostgreSQL", () => {
  it("accepts current organization and venue grants, and self only for own User", async () => {
    expect(await attempt("orgA", f.orgA, "user.read")).toBe("organization");
    expect(await attempt("a1Only", f.orgA, "venue.read", f.a1)).toBe("venue");
    expect(
      await attempt("a1Only", f.orgA, "user.read.self", undefined, {
        kind: "user",
        id: f.identities.a1Only.user,
      }),
    ).toBe("self");
  });
  it("denies missing capability and a role name without a mapping", async () => {
    await expect(attempt("a1Only", f.orgA, "user.read")).rejects.toBeInstanceOf(
      PeopleAccessDenied,
    );
    await adminPool.query(
      "INSERT INTO projectx_test.roles(id,organization_id,scope,name) VALUES ('018fc7ef-4350-7a00-8000-000000000042',$1,'ORGANIZATION','Admin')",
      [f.orgA],
    );
    await adminPool.query(
      "INSERT INTO projectx_test.organization_role_grants(id,organization_id,membership_id,role_id) VALUES ('018fc7ef-4350-7a00-8000-000000000043',$1,$2,'018fc7ef-4350-7a00-8000-000000000042')",
      [f.orgA, f.identities.a2Only.membership],
    );
    await expect(
      attempt("a2Only", f.orgA, "user.manage"),
    ).rejects.toBeInstanceOf(PeopleAccessDenied);
  });
  it("denies disabled User immediately", async () => {
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=now() WHERE id=$1",
      [f.identities.orgA.user],
    );
    await expect(attempt("orgA", f.orgA, "user.read")).rejects.toBeInstanceOf(
      PeopleAccessDenied,
    );
  });
  it("denies revoked membership and its dependent venue grant", async () => {
    await adminPool.query(
      "UPDATE projectx_test.organization_memberships SET revoked_at=now() WHERE id=$1",
      [f.identities.a1Only.membership],
    );
    await expect(
      attempt("a1Only", f.orgA, "user.read.self", undefined, {
        kind: "user",
        id: f.identities.a1Only.user,
      }),
    ).rejects.toBeInstanceOf(PeopleAccessDenied);
    await expect(
      attempt("a1Only", f.orgA, "venue.read", f.a1),
    ).rejects.toBeInstanceOf(PeopleAccessDenied);
  });
  it("denies revoked venue access and revoked grant on next operation", async () => {
    await adminPool.query(
      "UPDATE projectx_test.venue_access SET revoked_at=now() WHERE id=$1",
      [f.identities.a1Only.access[0]],
    );
    await expect(
      attempt("a1Only", f.orgA, "venue.read", f.a1),
    ).rejects.toBeInstanceOf(PeopleAccessDenied);
    await adminPool.query(
      "UPDATE projectx_test.organization_role_grants SET revoked_at=now() WHERE id=$1",
      [f.orgGrant],
    );
    await expect(attempt("orgA", f.orgA, "user.read")).rejects.toBeInstanceOf(
      PeopleAccessDenied,
    );
  });
  it("denies SELF access to another User and a known foreign User UUID", async () => {
    await expect(
      attempt("a1Only", f.orgA, "user.read.self", undefined, {
        kind: "user",
        id: f.identities.orgA.user,
      }),
    ).rejects.toBeInstanceOf(PeopleAccessDenied);
    await expect(
      attempt("orgA", f.orgA, "user.read", undefined, {
        kind: "user",
        id: f.identities.orgB.user,
      }),
    ).rejects.toBeInstanceOf(PeopleAccessDenied);
  });
  it("rejects spoofed organization and venue selectors before establishing context", async () => {
    await expect(attempt("orgA", f.orgB, "user.read")).rejects.toBeInstanceOf(
      PeopleAccessDenied,
    );
    await expect(
      attempt("a1Only", f.orgA, "venue.read", f.a2),
    ).rejects.toBeInstanceOf(PeopleAccessDenied);
    await expect(
      attempt("a1Only", f.orgB, "venue.read", f.b1),
    ).rejects.toBeInstanceOf(PeopleAccessDenied);
  });
});
