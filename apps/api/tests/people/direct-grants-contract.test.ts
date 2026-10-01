import { readFile } from "node:fs/promises";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import specification from "../../../../packages/contracts/openapi.json" with {
  type: "json",
};
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" });
const body = {
  email: "contract@example.invalid",
  firstName: null,
  lastName: null,
  jobTitle: null,
  emailNotificationsEnabled: null,
  suspended: false,
  organizationRoleIds: ["018fc7ef-4350-7a00-8000-000000000001"],
  venues: [],
};
describe("PEOPLE-04P contract validation without database substitutes", () => {
  it("keeps canonical permission IDs identical to the approved registry", async () => {
    const registry = JSON.parse(
      await readFile(
        new URL(
          "../../../../docs/security/permission-registry.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(
      [...specification.components.schemas.PeoplePermissionId.enum].sort(),
    ).toEqual(registry.permissions.map((p: { id: string }) => p.id).sort());
  });
  it("accepts optional canonical selections and denies unknown/duplicate/unbound fields", async () => {
    const instance = createApp(config);
    try {
      for (const payload of [
        body,
        { ...body, organizationPermissionIds: [] },
        { ...body, organizationPermissionIds: ["user.read"] },
      ]) {
        const result = await instance.inject({
          method: "POST",
          url: "/api/v1/people/accounts",
          payload,
          headers: { "idempotency-key": "contract-key" },
        });
        expect(result.statusCode).toBe(401); // validation accepted; not an authorization/database verification
      }
      for (const payload of [
        { ...body, organizationPermissionIds: ["not.canonical"] },
        { ...body, organizationPermissionIds: ["user.read", "user.read"] },
        { ...body, venuePermissionIds: ["venue.read"] },
        {
          ...body,
          venues: [
            {
              venueId: body.organizationRoleIds[0],
              roleIds: body.organizationRoleIds,
              permissionIds: ["not.canonical"],
            },
          ],
        },
        {
          ...body,
          venues: [
            {
              venueId: body.organizationRoleIds[0],
              roleIds: body.organizationRoleIds,
              unboundPermissionIds: ["venue.read"],
            },
          ],
        },
      ])
        expect(
          (
            await instance.inject({
              method: "POST",
              url: "/api/v1/people/accounts",
              payload,
              headers: { "idempotency-key": "contract-key" },
            })
          ).statusCode,
        ).toBe(400);
    } finally {
      await instance.close();
    }
  });
  it("requires trusted options identity and rejects all caller-selected query context", async () => {
    const instance = createApp(config, {
      peopleAddUser: {
        runtimePool: {} as Pool,
        resolveTrustedScope: async () => null,
      },
    });
    try {
      expect(
        (await instance.inject("/api/v1/people/accounts/options")).statusCode,
      ).toBe(401);
      expect(
        (
          await instance.inject(
            "/api/v1/people/accounts/options?organizationId=x",
          )
        ).statusCode,
      ).toBe(400);
    } finally {
      await instance.close();
    }
  });
});
