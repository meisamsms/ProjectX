import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import type { AddUserRequest } from "../../src/people/add-user/create.js";

describe("PEOPLE-04 request validation", () => {
  it("preserves notification null, false and true before authorization and persistence", async () => {
    let observed: AddUserRequest | undefined;
    const app = createApp(
      loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" }),
      {
        peopleAddUser: {
          runtimePool: {} as never,
          resolveTrustedScope: async (request) => {
            observed = request.body as AddUserRequest;
            return null;
          },
        },
      },
    );
    try {
      for (const value of [null, false, true]) {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/people/accounts",
          headers: { "idempotency-key": "notification-validation" },
          payload: {
            email: "new.user@example.invalid",
            firstName: null,
            lastName: null,
            jobTitle: null,
            emailNotificationsEnabled: value,
            suspended: false,
            organizationRoleIds: ["018fc7ef-4350-7a00-8000-000000000001"],
            venues: [],
          },
        });
        expect(response.statusCode).toBe(401);
        expect(observed?.emailNotificationsEnabled).toBe(value);
      }
    } finally {
      await app.close();
    }
  });
});
