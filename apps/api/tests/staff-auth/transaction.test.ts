import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { expect, it, vi } from "vitest";
import {
  bindVerifiedPeopleIdentity,
  withAuthorizedPeopleTransaction,
} from "../../src/people/authorization/context.js";

it("AUTH-N15 broken rollback destroys pooled client and preserves original error", async () => {
  const original = new Error("operation failed"),
    release = vi.fn();
  const query = vi.fn(async (sql: string) => {
    if (sql === "ROLLBACK") throw new Error("rollback unavailable");
    return { rows: [{ allowed: true }] };
  });
  const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
  await expect(
    withAuthorizedPeopleTransaction(
      pool,
      bindVerifiedPeopleIdentity(randomUUID()),
      { organizationId: randomUUID(), permissionId: "user.read" },
      async () => {
        throw original;
      },
    ),
  ).rejects.toBe(original);
  expect(release).toHaveBeenCalledWith(true);
  expect(query).toHaveBeenCalledWith(
    "SELECT set_config('app.venue_id',$1,true)",
    [""],
  );
});
