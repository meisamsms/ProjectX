import type { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import specification from "../../../../packages/contracts/openapi.json" with {
  type: "json",
};
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { normalizeBookedByName } from "../../src/people/booked-by/service.js";

const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" });
const base = "/api/v1/people/booked-by-names";
const id = "018fc7ef-4350-7a00-8000-000000000001";
const apps: ReturnType<typeof createApp>[] = [];
function app() {
  const instance = createApp(config);
  apps.push(instance);
  return instance;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((instance) => instance.close()));
});
describe("PEOPLE-07A database-independent contract validation (not DB/RLS verification)", () => {
  it("normalizes case-preserving Unicode/plain text and bounds by code point", () => {
    expect(normalizeBookedByName("\u00a0 MiXeD <b>plain</b> \u3000")).toBe(
      "MiXeD <b>plain</b>",
    );
    expect(normalizeBookedByName("😀".repeat(120))).toBe("😀".repeat(120));
    for (const invalid of [
      "",
      " ",
      "a".repeat(121),
      "😀".repeat(121),
      "bad\nname",
      "bad\tname",
      "bad\u0000name",
      "bad\u0085name",
      "\ud800",
      null,
      12,
    ])
      expect(() => normalizeBookedByName(invalid)).toThrow();
  });
  it("accepts generated list/add/save contracts only up to the unauthenticated boundary", async () => {
    const instance = app();
    const requests = [
      { method: "GET" as const, url: base },
      { method: "GET" as const, url: `${base}?limit=100&cursor=${id}` },
      { method: "POST" as const, url: base, payload: { displayName: "Name" } },
      {
        method: "POST" as const,
        url: base,
        payload: { displayName: "😀".repeat(120) },
      },
      {
        method: "PATCH" as const,
        url: `${base}/${id}`,
        payload: { displayName: "Name", version: 1 },
      },
    ];
    for (const request of requests) {
      const response = await instance.inject(request);
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        code: "UNAUTHENTICATED",
        message: "Authentication required",
        requestId: expect.any(String),
      });
    }
  });
  it("rejects invalid names, non-string coercion and caller-supplied security/identity fields", async () => {
    const instance = app();
    for (const payload of [
      null,
      [],
      {},
      { displayName: null },
      { displayName: 3 },
      { displayName: false },
      { displayName: "" },
      { displayName: " " },
      { displayName: "a".repeat(121) },
      { displayName: "a\nb" },
      { displayName: "😀".repeat(121) },
      { displayName: "\ud800" },
      ...[
        "organizationId",
        "venueId",
        "userId",
        "role",
        "permissions",
        "id",
        "version",
        "email",
        "archived",
      ].map((key) => ({ displayName: "Name", [key]: id })),
    ]) {
      const response = await instance.inject({
        method: "POST",
        url: base,
        payload: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        code: "INVALID_REQUEST",
        message: "Invalid request",
        requestId: expect.any(String),
      });
    }
  });
  it("requires a numeric integer update precondition and UUID path", async () => {
    const instance = app();
    for (const version of [
      undefined,
      null,
      "1",
      true,
      0,
      -1,
      1.5,
      2147483647,
    ]) {
      expect(
        (
          await instance.inject({
            method: "PATCH",
            url: `${base}/${id}`,
            payload: { displayName: "Name", version },
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await instance.inject({
          method: "PATCH",
          url: `${base}/not-a-uuid`,
          payload: { displayName: "Name", version: 1 },
        })
      ).statusCode,
    ).toBe(400);
  });
  it("rejects unknown, duplicate or malformed queries; no body/query tenant authority", async () => {
    const instance = app();
    for (const query of [
      "organizationId=x",
      "venueId=x",
      "actor=x",
      "limit=0",
      "limit=101",
      "limit=1.5",
      "limit=01",
      "limit=true",
      "limit=1&limit=2",
      "cursor=invalid",
      `cursor=${id}&cursor=${id}`,
    ])
      expect(
        (await instance.inject({ method: "GET", url: `${base}?${query}` }))
          .statusCode,
      ).toBe(400);
    for (const method of ["POST", "PATCH"] as const)
      expect(
        (
          await instance.inject({
            method,
            url:
              method === "POST"
                ? `${base}?venueId=${id}`
                : `${base}/${id}?venueId=${id}`,
            payload: {
              displayName: "Name",
              ...(method === "PATCH" ? { version: 1 } : {}),
            },
          })
        ).statusCode,
      ).toBe(400);
  });
  it("requires resolver-bound identity; browser authorization headers are not a resolver", async () => {
    const instance = createApp(config, {
      peopleBookedBy: {
        runtimePool: {} as Pool,
        resolveTrustedScope: async () => null,
      },
    });
    apps.push(instance);
    expect(
      (
        await instance.inject({
          method: "POST",
          url: base,
          payload: { displayName: "Name" },
          headers: {
            authorization: "Bearer caller-selected",
            "x-organization-id": id,
            "x-venue-id": id,
          },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("exposes minimal generated response fields, a version conflict, and no delete operation", async () => {
    expect(
      Object.keys(
        specification.components.schemas.BookedByName.properties,
      ).sort(),
    ).toEqual(["displayName", "id", "version"]);
    expect(
      specification.paths["/api/v1/people/booked-by-names/{id}"].patch
        .responses["409"],
    ).toBeDefined();
    expect(
      Object.keys(specification.paths["/api/v1/people/booked-by-names/{id}"]),
    ).toEqual(["patch"]);
    expect(
      (await app().inject({ method: "DELETE", url: `${base}/${id}` }))
        .statusCode,
    ).toBe(404);
  });
});
