import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import specification from "../../../../packages/contracts/openapi.json" with {
  type: "json",
};
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { newPeopleId } from "../../src/people/persistence/id.js";
import {
  SESSION_COOKIE,
  csrfFor,
  hash,
  secret,
} from "../../src/staff-auth/credentials.js";
import { postgresStaffStore } from "../../src/staff-auth/store.js";
import {
  adminPool,
  freshPeopleFixture,
  startRuntime,
  stopRuntime,
} from "../people/fixtures/runtime.js";
import { config as authConfig } from "../staff-auth/fixtures.js";

const base = "/api/v1/staff/reservations";
const year = new Date().getUTCFullYear() + 2;
const date = `${year}-01-15`;

let runtime: Pool;
let f: Awaited<ReturnType<typeof freshPeopleFixture>>;
let store: ReturnType<typeof postgresStaffStore>;
let tableId: string;
let secondTableId: string;
let shiftId: string;

const allReservationPermissions = [
  "reservation.read",
  "reservation.create",
  "reservation.update",
  "reservation.checkin",
  "reservation.seat",
  "reservation.cancel",
] as const;

async function grantPermissions(
  org: string,
  venue: string,
  access: string,
  actor: string,
  permissions: readonly string[] = allReservationPermissions,
) {
  for (const permission of permissions) {
    await adminPool.query(
      `INSERT INTO projectx_test.venue_permission_grants(
        id,organization_id,venue_id,venue_access_id,permission_id,granted_by_user_id
      ) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT DO NOTHING`,
      [newPeopleId(), org, venue, access, permission, actor],
    );
  }
}

async function revokePermission(access: string, permission: string) {
  await adminPool.query(
    "UPDATE projectx_test.venue_permission_grants SET revoked_at=now(),version=version+1 WHERE venue_access_id=$1 AND permission_id=$2 AND revoked_at IS NULL",
    [access, permission],
  );
}

async function configureVenue(
  org = f.orgA,
  venue = f.a1,
  serviceDate = date,
  timezone = "America/Chicago",
) {
  const t1 = newPeopleId();
  const t2 = newPeopleId();
  const shift = newPeopleId();
  await adminPool.query(
    `INSERT INTO projectx_test.reservation_venue_settings(organization_id,venue_id,timezone)
     VALUES($1,$2,$3)
     ON CONFLICT (organization_id,venue_id) DO UPDATE SET timezone=EXCLUDED.timezone`,
    [org, venue, timezone],
  );
  await adminPool.query(
    "INSERT INTO projectx_test.reservation_tables(id,organization_id,venue_id,label,capacity,active) VALUES($1,$2,$3,'Table 1',4,true),($4,$2,$3,'Table 2',4,true)",
    [t1, org, venue, t2],
  );
  await adminPool.query(
    "INSERT INTO projectx_test.reservation_shifts VALUES($1,$2,$3,$4,720,1020,60,15,1,6)",
    [shift, org, venue, serviceDate],
  );
  return { t1, t2, shift };
}

async function issueStaffSession(subject = "orgA") {
  const credential = secret();
  const session = await store.issue(
    { issuer: "https://fixture.invalid", subject, authenticatedAt: null },
    hash(credential),
    null,
  );
  if (!session || "denial" in session)
    throw new Error(`Failed to issue staff session for ${subject}`);
  const csrf = csrfFor(credential);
  return {
    credential,
    csrf,
    session,
    getHeaders: () => ({
      host: "app.test",
      cookie: `${SESSION_COOKIE}=${credential}`,
    }),
    mutationHeaders: (contextVersion = session.contextVersion) => ({
      host: "app.test",
      origin: authConfig.origin,
      cookie: `${SESSION_COOKIE}=${credential}`,
      "x-projectx-csrf": csrf,
      "x-projectx-context-version": String(contextVersion),
    }),
  };
}

function createTestApp(pool: Pool = runtime) {
  const logs: string[] = [];
  const stream = new PassThrough();
  stream.on("data", (chunk) => logs.push(String(chunk)));
  const app = createApp(loadConfig({ NODE_ENV: "test", LOG_LEVEL: "info" }), {
    loggerStream: stream,
    staffAuth: {
      config: authConfig,
      store,
      runtimePool: pool,
      oidc: {
        authorize: async () => {
          throw new Error("Unexpected OIDC authorize");
        },
        callback: async () => {
          throw new Error("Unexpected OIDC callback");
        },
      },
    },
  });
  return { app, logs };
}

beforeAll(async () => {
  await freshPeopleFixture();
  runtime = await startRuntime();
  await adminPool.query(
    "GRANT projectx_staff_auth_runtime TO projectx_people_test_login",
  );
  store = postgresStaffStore(runtime);
});

beforeEach(async () => {
  f = await freshPeopleFixture();
  await grantPermissions(
    f.orgA,
    f.a1,
    f.orgAdminAccess,
    f.identities.orgA.user,
  );
  await grantPermissions(
    f.orgA,
    f.a2,
    f.identities.a2Only.access[0] ?? "",
    f.identities.a2Only.user,
  );
  await grantPermissions(
    f.orgB,
    f.b1,
    f.identities.orgB.access[0] ?? "",
    f.identities.orgB.user,
  );
  const configured = await configureVenue();
  tableId = configured.t1;
  secondTableId = configured.t2;
  shiftId = configured.shift;
});

afterAll(async () => {
  await stopRuntime();
});

describe("RESERVATION-DOMAIN-004 authenticated Staff Reservation HTTP API (PostgreSQL 16)", () => {
  it("DEMONSTRATION: executes authenticated availability, create, get, list, modify, check-in, seat and cancel over HTTP", async () => {
    const staff = await issueStaffSession("orgA");
    const { app } = createTestApp();
    try {
      const availabilityResponse = await app.inject({
        method: "GET",
        url: `${base}/availability?date=${date}&partySize=2&fromMinute=720&toMinute=900`,
        headers: staff.getHeaders(),
      });
      expect(availabilityResponse.statusCode).toBe(200);
      expect(availabilityResponse.headers["cache-control"]).toBe("no-store");
      expect(availabilityResponse.headers["referrer-policy"]).toBe(
        "no-referrer",
      );
      const initialSlots = availabilityResponse.json().items as Array<{
        tableId: string;
        shiftId: string;
        startsAt: string;
        endsAt: string;
        timezone: string;
      }>;
      const firstSlot = initialSlots.find(
        (s) => s.tableId === tableId && s.startsAt === `${date}T18:00:00.000Z`,
      );
      const secondSlot = initialSlots.find(
        (s) => s.tableId === tableId && s.startsAt === `${date}T19:15:00.000Z`,
      );
      const cancelSlot = initialSlots.find(
        (s) =>
          s.tableId === secondTableId && s.startsAt === `${date}T18:00:00.000Z`,
      );
      if (!firstSlot || !secondSlot || !cancelSlot)
        throw new Error("Missing expected availability slots");

      // 1. Create reservation
      const createKey = randomUUID();
      const createResponse = await app.inject({
        method: "POST",
        url: base,
        headers: staff.mutationHeaders(),
        payload: {
          date,
          partySize: 2,
          tableId: firstSlot.tableId,
          shiftId: firstSlot.shiftId,
          startsAt: firstSlot.startsAt,
          guestName: "  Ada Lovelace  ",
          guestEmail: "  ada@example.test  ",
          idempotencyKey: createKey,
        },
      });
      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json();
      expect(created).toMatchObject({
        organizationId: f.orgA,
        venueId: f.a1,
        tableId,
        shiftId,
        date,
        startsAt: `${date}T18:00:00.000Z`,
        endsAt: `${date}T19:00:00.000Z`,
        timezone: "America/Chicago",
        partySize: 2,
        guestName: "Ada Lovelace",
        guestEmail: "ada@example.test",
        status: "BOOKED",
        revision: 1,
      });

      // Slot is now unavailable on Table 1 at 18:00Z
      const afterCreateAvail = (
        await app.inject({
          method: "GET",
          url: `${base}/availability?date=${date}&partySize=2&fromMinute=720&toMinute=900`,
          headers: staff.getHeaders(),
        })
      ).json().items as typeof initialSlots;
      expect(
        afterCreateAvail.some(
          (s) =>
            s.tableId === tableId && s.startsAt === `${date}T18:00:00.000Z`,
        ),
      ).toBe(false);

      // 2. Get and List reservation
      const getResponse = await app.inject({
        method: "GET",
        url: `${base}/${created.id}`,
        headers: staff.getHeaders(),
      });
      expect(getResponse.statusCode).toBe(200);
      expect(getResponse.json()).toEqual(created);

      const listResponse = await app.inject({
        method: "GET",
        url: `${base}?date=${date}&limit=50`,
        headers: staff.getHeaders(),
      });
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().items).toEqual([created]);

      // 3. Modify reservation to 19:15Z
      const modifyKey = randomUUID();
      const modifyResponse = await app.inject({
        method: "PATCH",
        url: `${base}/${created.id}`,
        headers: staff.mutationHeaders(),
        payload: {
          expectedRevision: 1,
          idempotencyKey: modifyKey,
          date,
          startsAt: secondSlot.startsAt,
          tableId: secondSlot.tableId,
          shiftId: secondSlot.shiftId,
          partySize: 4,
        },
      });
      expect(modifyResponse.statusCode).toBe(200);
      const modified = modifyResponse.json();
      expect(modified).toMatchObject({
        id: created.id,
        startsAt: `${date}T19:15:00.000Z`,
        endsAt: `${date}T20:15:00.000Z`,
        partySize: 4,
        status: "BOOKED",
        revision: 2,
      });

      // 18:00Z is restored; 19:15Z is now occupied
      const afterModifyAvail = (
        await app.inject({
          method: "GET",
          url: `${base}/availability?date=${date}&partySize=2&fromMinute=720&toMinute=900`,
          headers: staff.getHeaders(),
        })
      ).json().items as typeof initialSlots;
      expect(
        afterModifyAvail.some(
          (s) =>
            s.tableId === tableId && s.startsAt === `${date}T18:00:00.000Z`,
        ),
      ).toBe(true);
      expect(
        afterModifyAvail.some(
          (s) =>
            s.tableId === tableId && s.startsAt === `${date}T19:15:00.000Z`,
        ),
      ).toBe(false);

      // 4. Check in reservation (BOOKED -> CHECKED_IN)
      const checkInKey = randomUUID();
      const checkInResponse = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/check-in`,
        headers: staff.mutationHeaders(),
        payload: {
          expectedRevision: 2,
          idempotencyKey: checkInKey,
        },
      });
      expect(checkInResponse.statusCode).toBe(200);
      expect(checkInResponse.json()).toMatchObject({
        id: created.id,
        status: "CHECKED_IN",
        revision: 3,
      });

      // 5. Seat reservation (CHECKED_IN -> SEATED)
      const seatKey = randomUUID();
      const seatResponse = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/seat`,
        headers: staff.mutationHeaders(),
        payload: {
          expectedRevision: 3,
          idempotencyKey: seatKey,
        },
      });
      expect(seatResponse.statusCode).toBe(200);
      const seated = seatResponse.json();
      expect(seated).toMatchObject({
        id: created.id,
        status: "SEATED",
        revision: 4,
      });

      // Capacity remains occupied while SEATED
      const afterSeatAvail = (
        await app.inject({
          method: "GET",
          url: `${base}/availability?date=${date}&partySize=2&fromMinute=720&toMinute=900`,
          headers: staff.getHeaders(),
        })
      ).json().items as typeof initialSlots;
      expect(
        afterSeatAvail.some(
          (s) =>
            s.tableId === tableId && s.startsAt === `${date}T19:15:00.000Z`,
        ),
      ).toBe(false);

      // 6. Create a second booking and cancel it (BOOKED -> CANCELLED)
      const toCancel = (
        await app.inject({
          method: "POST",
          url: base,
          headers: staff.mutationHeaders(),
          payload: {
            date,
            partySize: 2,
            tableId: cancelSlot.tableId,
            shiftId: cancelSlot.shiftId,
            startsAt: cancelSlot.startsAt,
            guestName: "Grace Hopper",
            guestEmail: "grace@example.test",
            idempotencyKey: randomUUID(),
          },
        })
      ).json();
      const cancelResponse = await app.inject({
        method: "POST",
        url: `${base}/${toCancel.id}/cancel`,
        headers: staff.mutationHeaders(),
      });
      expect(cancelResponse.statusCode).toBe(200);
      expect(cancelResponse.json()).toMatchObject({
        id: toCancel.id,
        status: "CANCELLED",
        revision: 2,
      });

      // Cancelled slot is available again
      const afterCancelAvail = (
        await app.inject({
          method: "GET",
          url: `${base}/availability?date=${date}&partySize=2&fromMinute=720&toMinute=900`,
          headers: staff.getHeaders(),
        })
      ).json().items as typeof initialSlots;
      expect(
        afterCancelAvail.some(
          (s) =>
            s.tableId === secondTableId &&
            s.startsAt === `${date}T18:00:00.000Z`,
        ),
      ).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("enforces staff session authentication, revocation, disabled-account denial and Venue context requirement across all endpoints", async () => {
    const staff = await issueStaffSession("orgA");
    const { app } = createTestApp();
    const id = randomUUID();
    const endpoints = [
      {
        method: "GET" as const,
        url: `${base}/availability?date=${date}&partySize=2`,
      },
      { method: "GET" as const, url: `${base}?date=${date}` },
      {
        method: "POST" as const,
        url: base,
        payload: {
          date,
          partySize: 2,
          tableId,
          shiftId,
          startsAt: `${date}T18:00:00.000Z`,
          guestName: "Guest",
          guestEmail: "guest@example.test",
          idempotencyKey: randomUUID(),
        },
      },
      { method: "GET" as const, url: `${base}/${id}` },
      {
        method: "PATCH" as const,
        url: `${base}/${id}`,
        payload: {
          expectedRevision: 1,
          idempotencyKey: randomUUID(),
          date,
          startsAt: `${date}T18:15:00.000Z`,
          tableId,
          shiftId,
          partySize: 2,
        },
      },
      {
        method: "POST" as const,
        url: `${base}/${id}/check-in`,
        payload: { expectedRevision: 1, idempotencyKey: randomUUID() },
      },
      {
        method: "POST" as const,
        url: `${base}/${id}/seat`,
        payload: { expectedRevision: 2, idempotencyKey: randomUUID() },
      },
      { method: "POST" as const, url: `${base}/${id}/cancel` },
    ];

    try {
      // 1. Missing or forged session cookies -> 401
      for (const endpoint of endpoints) {
        for (const cookie of ["", `${SESSION_COOKIE}=${secret()}`]) {
          const response = await app.inject({
            ...endpoint,
            headers: {
              host: "app.test",
              origin: authConfig.origin,
              cookie,
              authorization: "Bearer spoofed-token",
              "x-user-id": f.identities.orgA.user,
              "x-organization-id": f.orgA,
              "x-venue-id": f.a1,
              "x-projectx-csrf": staff.csrf,
              "x-projectx-context-version": "1",
            },
          });
          expect(response.statusCode).toBe(401);
          expect(response.json()).toEqual({
            code: "UNAUTHENTICATED",
            message: "Authentication required",
            requestId: expect.any(String),
          });
        }
      }

      // 2. Organization-only session (venueId: null) -> 403 on all reservation endpoints
      const switched = await app.inject({
        method: "POST",
        url: "/api/v1/staff-auth/context",
        headers: staff.mutationHeaders(1),
        payload: {
          organizationId: f.orgA,
          venueId: null,
          contextVersion: 1,
        },
      });
      expect(switched.statusCode).toBe(200);
      expect(switched.json().venueId).toBeNull();
      expect(switched.json().contextVersion).toBe(2);

      for (const endpoint of endpoints) {
        const response = await app.inject({
          ...endpoint,
          headers:
            endpoint.method === "GET"
              ? staff.getHeaders()
              : staff.mutationHeaders(2),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual({
          code: "FORBIDDEN",
          message: "Request denied",
          requestId: expect.any(String),
        });
      }

      // 3. Disabled user -> 403 and clears session cookie
      await adminPool.query(
        "UPDATE projectx_test.users SET disabled_at=now(),version=version+1 WHERE id=$1",
        [f.identities.orgA.user],
      );
      const disabledResponse = await app.inject({
        method: "GET",
        url: `${base}/availability?date=${date}&partySize=2`,
        headers: staff.getHeaders(),
      });
      expect(disabledResponse.statusCode).toBe(403);
      expect(String(disabledResponse.headers["set-cookie"])).toContain(
        "Max-Age=0",
      );

      // 4. Logged-out session -> 401
      const otherStaff = await issueStaffSession("a2Only");
      const logoutResponse = await app.inject({
        method: "POST",
        url: "/api/v1/staff-auth/logout",
        headers: otherStaff.mutationHeaders(1),
      });
      expect(logoutResponse.statusCode).toBe(204);
      const afterLogout = await app.inject({
        method: "GET",
        url: `${base}?date=${date}`,
        headers: otherStaff.getHeaders(),
      });
      expect(afterLogout.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("enforces CSRF, Origin/Referer, canonical Host and X-ProjectX-Context-Version on reservation mutations", async () => {
    const staff = await issueStaffSession("orgA");
    const { app } = createTestApp();
    try {
      const created = (
        await app.inject({
          method: "POST",
          url: base,
          headers: staff.mutationHeaders(1),
          payload: {
            date,
            partySize: 2,
            tableId,
            shiftId,
            startsAt: `${date}T18:00:00.000Z`,
            guestName: "CSRF Guest",
            guestEmail: "csrf@example.test",
            idempotencyKey: randomUUID(),
          },
        })
      ).json();

      // Foreign Host or X-Forwarded-Host rejected on GET and POST
      for (const badHeaders of [
        { ...staff.getHeaders(), host: "evil.test" },
        { ...staff.getHeaders(), "x-forwarded-host": "evil.test" },
      ]) {
        expect(
          (
            await app.inject({
              method: "GET",
              url: `${base}/${created.id}`,
              headers: badHeaders,
            })
          ).statusCode,
        ).toBe(403);
      }

      // Missing/invalid CSRF or invalid Origin rejected before mutation executes
      const mutations = [
        {
          method: "POST" as const,
          url: base,
          payload: {
            date,
            partySize: 2,
            tableId: secondTableId,
            shiftId,
            startsAt: `${date}T18:00:00.000Z`,
            guestName: "Blocked",
            guestEmail: "blocked@example.test",
            idempotencyKey: randomUUID(),
          },
        },
        {
          method: "PATCH" as const,
          url: `${base}/${created.id}`,
          payload: {
            expectedRevision: 1,
            idempotencyKey: randomUUID(),
            date,
            startsAt: `${date}T19:00:00.000Z`,
            tableId,
            shiftId,
            partySize: 2,
          },
        },
        {
          method: "POST" as const,
          url: `${base}/${created.id}/check-in`,
          payload: { expectedRevision: 1, idempotencyKey: randomUUID() },
        },
        {
          method: "POST" as const,
          url: `${base}/${created.id}/seat`,
          payload: { expectedRevision: 1, idempotencyKey: randomUUID() },
        },
        {
          method: "POST" as const,
          url: `${base}/${created.id}/cancel`,
        },
      ];

      for (const mutation of mutations) {
        for (const override of [
          { "x-projectx-csrf": "" },
          { "x-projectx-csrf": "0".repeat(64) },
          { origin: "https://attacker.test" },
          { origin: "null" },
        ]) {
          const response = await app.inject({
            ...mutation,
            headers: { ...staff.mutationHeaders(1), ...override },
          });
          expect(response.statusCode).toBe(403);
        }

        // Stale or malformed context version -> 409 CONFLICT
        for (const version of ["", "0", "2", "abc"]) {
          const response = await app.inject({
            ...mutation,
            headers: {
              ...staff.mutationHeaders(1),
              "x-projectx-context-version": version,
            },
          });
          expect(response.statusCode).toBe(409);
          expect(response.json()).toEqual({
            code: "CONFLICT",
            message: "Session context changed",
            requestId: expect.any(String),
          });
        }
      }

      // Context switch increments contextVersion to 2; old tab with version 1 fails 409
      const switched = await app.inject({
        method: "POST",
        url: "/api/v1/staff-auth/context",
        headers: staff.mutationHeaders(1),
        payload: {
          organizationId: f.orgA,
          venueId: f.a1,
          contextVersion: 1,
        },
      });
      expect(switched.statusCode).toBe(200);
      expect(switched.json().contextVersion).toBe(2);

      const staleCheckIn = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/check-in`,
        headers: staff.mutationHeaders(1),
        payload: { expectedRevision: 1, idempotencyKey: randomUUID() },
      });
      expect(staleCheckIn.statusCode).toBe(409);

      // Same-origin Referer without Origin header succeeds with current contextVersion 2
      const { origin: _removed, ...withoutOrigin } = staff.mutationHeaders(2);
      const validRefererCheckIn = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/check-in`,
        headers: {
          ...withoutOrigin,
          referer: `${authConfig.origin}/staff/reservations`,
        },
        payload: { expectedRevision: 1, idempotencyKey: randomUUID() },
      });
      expect(validRefererCheckIn.statusCode).toBe(200);
      expect(validRefererCheckIn.json().status).toBe("CHECKED_IN");
    } finally {
      await app.close();
    }
  });

  it("enforces granular operation-specific permissions (read, create, update, checkin, seat, cancel)", async () => {
    const staff = await issueStaffSession("orgA");
    const { app } = createTestApp();
    try {
      const created = (
        await app.inject({
          method: "POST",
          url: base,
          headers: staff.mutationHeaders(),
          payload: {
            date,
            partySize: 2,
            tableId,
            shiftId,
            startsAt: `${date}T18:00:00.000Z`,
            guestName: "Permission Guest",
            guestEmail: "perm@example.test",
            idempotencyKey: randomUUID(),
          },
        })
      ).json();

      // Revoke create, update, checkin, seat, cancel — keep only reservation.read
      for (const perm of [
        "reservation.create",
        "reservation.update",
        "reservation.checkin",
        "reservation.seat",
        "reservation.cancel",
      ]) {
        await revokePermission(f.orgAdminAccess, perm);
      }

      // Reads still succeed
      expect(
        (
          await app.inject({
            method: "GET",
            url: `${base}/availability?date=${date}&partySize=2`,
            headers: staff.getHeaders(),
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: "GET",
            url: `${base}/${created.id}`,
            headers: staff.getHeaders(),
          })
        ).statusCode,
      ).toBe(200);

      // All mutations fail 403 FORBIDDEN
      expect(
        (
          await app.inject({
            method: "POST",
            url: base,
            headers: staff.mutationHeaders(),
            payload: {
              date,
              partySize: 2,
              tableId: secondTableId,
              shiftId,
              startsAt: `${date}T18:00:00.000Z`,
              guestName: "Denied",
              guestEmail: "denied@example.test",
              idempotencyKey: randomUUID(),
            },
          })
        ).statusCode,
      ).toBe(403);

      // Grant reservation.update only -> modify succeeds, but check-in, seat, cancel fail 403
      await grantPermissions(
        f.orgA,
        f.a1,
        f.orgAdminAccess,
        f.identities.orgA.user,
        ["reservation.update"],
      );
      const modified = await app.inject({
        method: "PATCH",
        url: `${base}/${created.id}`,
        headers: staff.mutationHeaders(),
        payload: {
          expectedRevision: 1,
          idempotencyKey: randomUUID(),
          date,
          startsAt: `${date}T19:00:00.000Z`,
          tableId,
          shiftId,
          partySize: 2,
        },
      });
      expect(modified.statusCode).toBe(200);
      expect(modified.json().revision).toBe(2);

      for (const deniedUrl of [
        `${base}/${created.id}/check-in`,
        `${base}/${created.id}/seat`,
        `${base}/${created.id}/cancel`,
      ]) {
        const res = await app.inject({
          method: "POST",
          url: deniedUrl,
          headers: staff.mutationHeaders(),
          ...(deniedUrl.endsWith("/cancel")
            ? {}
            : {
                payload: { expectedRevision: 2, idempotencyKey: randomUUID() },
              }),
        });
        expect(res.statusCode).toBe(403);
      }

      // Grant reservation.checkin (without reservation.seat) -> check-in succeeds, seat still fails 403
      await grantPermissions(
        f.orgA,
        f.a1,
        f.orgAdminAccess,
        f.identities.orgA.user,
        ["reservation.checkin"],
      );
      const checkedIn = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/check-in`,
        headers: staff.mutationHeaders(),
        payload: { expectedRevision: 2, idempotencyKey: randomUUID() },
      });
      expect(checkedIn.statusCode).toBe(200);
      expect(checkedIn.json().status).toBe("CHECKED_IN");

      const deniedSeat = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/seat`,
        headers: staff.mutationHeaders(),
        payload: { expectedRevision: 3, idempotencyKey: randomUUID() },
      });
      expect(deniedSeat.statusCode).toBe(403);

      // Grant reservation.seat (and revoke checkin) -> seat succeeds
      await revokePermission(f.orgAdminAccess, "reservation.checkin");
      await grantPermissions(
        f.orgA,
        f.a1,
        f.orgAdminAccess,
        f.identities.orgA.user,
        ["reservation.seat"],
      );
      const seated = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/seat`,
        headers: staff.mutationHeaders(),
        payload: { expectedRevision: 3, idempotencyKey: randomUUID() },
      });
      expect(seated.statusCode).toBe(200);
      expect(seated.json().status).toBe("SEATED");

      // Revoking reservation.read denies every endpoint including GET and mutations
      await revokePermission(f.orgAdminAccess, "reservation.read");
      expect(
        (
          await app.inject({
            method: "GET",
            url: `${base}/${created.id}`,
            headers: staff.getHeaders(),
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: "GET",
            url: `${base}?date=${date}`,
            headers: staff.getHeaders(),
          })
        ).statusCode,
      ).toBe(403);
    } finally {
      await app.close();
    }
  });

  it("enforces cross-Venue and cross-Organization isolation without leaking foreign reservations", async () => {
    await configureVenue(f.orgA, f.a2);
    await configureVenue(f.orgB, f.b1);
    const staffA1 = await issueStaffSession("orgA");
    const staffA2 = await issueStaffSession("a2Only");
    const staffOrgB = await issueStaffSession("orgB");
    const { app } = createTestApp();

    try {
      const bookingA1 = (
        await app.inject({
          method: "POST",
          url: base,
          headers: staffA1.mutationHeaders(),
          payload: {
            date,
            partySize: 2,
            tableId,
            shiftId,
            startsAt: `${date}T18:00:00.000Z`,
            guestName: "Secret VIP",
            guestEmail: "vip@example.test",
            idempotencyKey: randomUUID(),
          },
        })
      ).json();

      for (const foreignStaff of [staffA2, staffOrgB]) {
        // List in foreign venue returns empty list
        const listRes = await app.inject({
          method: "GET",
          url: `${base}?date=${date}`,
          headers: foreignStaff.getHeaders(),
        });
        expect(listRes.statusCode).toBe(200);
        expect(listRes.json().items).toEqual([]);
        expect(listRes.body).not.toContain("Secret VIP");
        expect(listRes.body).not.toContain("vip@example.test");

        // Get, modify, check-in, seat, cancel on A1 booking ID from A2 or OrgB all return 404 NOT_FOUND
        for (const request of [
          {
            method: "GET" as const,
            url: `${base}/${bookingA1.id}`,
            headers: foreignStaff.getHeaders(),
          },
          {
            method: "PATCH" as const,
            url: `${base}/${bookingA1.id}`,
            headers: foreignStaff.mutationHeaders(),
            payload: {
              expectedRevision: 1,
              idempotencyKey: randomUUID(),
              date,
              startsAt: `${date}T19:00:00.000Z`,
              tableId,
              shiftId,
              partySize: 2,
            },
          },
          {
            method: "POST" as const,
            url: `${base}/${bookingA1.id}/check-in`,
            headers: foreignStaff.mutationHeaders(),
            payload: { expectedRevision: 1, idempotencyKey: randomUUID() },
          },
          {
            method: "POST" as const,
            url: `${base}/${bookingA1.id}/seat`,
            headers: foreignStaff.mutationHeaders(),
            payload: { expectedRevision: 1, idempotencyKey: randomUUID() },
          },
          {
            method: "POST" as const,
            url: `${base}/${bookingA1.id}/cancel`,
            headers: foreignStaff.mutationHeaders(),
          },
        ]) {
          const response = await app.inject(request);
          expect(response.statusCode).toBe(404);
          expect(response.json()).toEqual({
            code: "NOT_FOUND",
            message: "Resource not found",
            requestId: expect.any(String),
          });
          expect(response.body).not.toContain("Secret VIP");
          expect(response.body).not.toContain("vip@example.test");
        }
      }

      // Original booking in A1 is completely intact
      const verifyA1 = await app.inject({
        method: "GET",
        url: `${base}/${bookingA1.id}`,
        headers: staffA1.getHeaders(),
      });
      expect(verifyA1.statusCode).toBe(200);
      expect(verifyA1.json().revision).toBe(1);
      expect(verifyA1.json().status).toBe("BOOKED");
    } finally {
      await app.close();
    }
  });

  it("preserves idempotent retries and maps capacity, revision, idempotency and state conflicts to deterministic 409 codes", async () => {
    const staff = await issueStaffSession("orgA");
    const { app } = createTestApp();
    try {
      const createKey = randomUUID();
      const createPayload = {
        date,
        partySize: 2,
        tableId,
        shiftId,
        startsAt: `${date}T18:00:00.000Z`,
        guestName: "Retry Guest",
        guestEmail: "retry@example.test",
        idempotencyKey: createKey,
      };
      const firstCreate = await app.inject({
        method: "POST",
        url: base,
        headers: staff.mutationHeaders(),
        payload: createPayload,
      });
      expect(firstCreate.statusCode).toBe(201);
      const created = firstCreate.json();

      // Exact create retry returns identical record with 201
      const retryCreate = await app.inject({
        method: "POST",
        url: base,
        headers: staff.mutationHeaders(),
        payload: createPayload,
      });
      expect(retryCreate.statusCode).toBe(201);
      expect(retryCreate.json()).toEqual(created);

      // Conflicting create retry with same idempotencyKey returns 409 IDEMPOTENCY_CONFLICT
      const conflictCreate = await app.inject({
        method: "POST",
        url: base,
        headers: staff.mutationHeaders(),
        payload: { ...createPayload, partySize: 4 },
      });
      expect(conflictCreate.statusCode).toBe(409);
      expect(conflictCreate.json().code).toBe("IDEMPOTENCY_CONFLICT");

      // Overlapping booking with new key on same table/time returns 409 CAPACITY_CONFLICT
      const overlapCreate = await app.inject({
        method: "POST",
        url: base,
        headers: staff.mutationHeaders(),
        payload: {
          ...createPayload,
          idempotencyKey: randomUUID(),
        },
      });
      expect(overlapCreate.statusCode).toBe(409);
      expect(overlapCreate.json().code).toBe("CAPACITY_CONFLICT");

      // Stale revision on modify returns 409 VERSION_CONFLICT
      const staleModify = await app.inject({
        method: "PATCH",
        url: `${base}/${created.id}`,
        headers: staff.mutationHeaders(),
        payload: {
          expectedRevision: 2,
          idempotencyKey: randomUUID(),
          date,
          startsAt: `${date}T19:00:00.000Z`,
          tableId,
          shiftId,
          partySize: 2,
        },
      });
      expect(staleModify.statusCode).toBe(409);
      expect(staleModify.json().code).toBe("VERSION_CONFLICT");

      // Skipping check-in (BOOKED -> SEATED) returns 409 INVALID_STATE
      const prematureSeat = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/seat`,
        headers: staff.mutationHeaders(),
        payload: { expectedRevision: 1, idempotencyKey: randomUUID() },
      });
      expect(prematureSeat.statusCode).toBe(409);
      expect(prematureSeat.json().code).toBe("INVALID_STATE");

      // Check-in with idempotent retry and subsequent seat
      const checkInKey = randomUUID();
      const checkedIn = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/check-in`,
        headers: staff.mutationHeaders(),
        payload: { expectedRevision: 1, idempotencyKey: checkInKey },
      });
      expect(checkedIn.statusCode).toBe(200);
      expect(checkedIn.json()).toMatchObject({
        status: "CHECKED_IN",
        revision: 2,
      });

      // Reusing checkInKey for seat returns 409 IDEMPOTENCY_CONFLICT
      const crossOpKey = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/seat`,
        headers: staff.mutationHeaders(),
        payload: { expectedRevision: 2, idempotencyKey: checkInKey },
      });
      expect(crossOpKey.statusCode).toBe(409);
      expect(crossOpKey.json().code).toBe("IDEMPOTENCY_CONFLICT");

      // Seat succeeds with fresh key
      const seatKey = randomUUID();
      const seated = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/seat`,
        headers: staff.mutationHeaders(),
        payload: { expectedRevision: 2, idempotencyKey: seatKey },
      });
      expect(seated.statusCode).toBe(200);
      expect(seated.json()).toMatchObject({
        status: "SEATED",
        revision: 3,
      });

      // Retrying earlier check-in with original key and expectedRevision=1 returns original CHECKED_IN snapshot (revision 2)
      const replayedCheckIn = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/check-in`,
        headers: staff.mutationHeaders(),
        payload: { expectedRevision: 1, idempotencyKey: checkInKey },
      });
      expect(replayedCheckIn.statusCode).toBe(200);
      expect(replayedCheckIn.json()).toMatchObject({
        status: "CHECKED_IN",
        revision: 2,
      });

      // Modifying or cancelling a SEATED reservation fails 409 INVALID_STATE
      const modifySeated = await app.inject({
        method: "PATCH",
        url: `${base}/${created.id}`,
        headers: staff.mutationHeaders(),
        payload: {
          expectedRevision: 3,
          idempotencyKey: randomUUID(),
          date,
          startsAt: `${date}T19:00:00.000Z`,
          tableId,
          shiftId,
          partySize: 2,
        },
      });
      expect(modifySeated.statusCode).toBe(409);
      expect(modifySeated.json().code).toBe("INVALID_STATE");

      const cancelSeated = await app.inject({
        method: "POST",
        url: `${base}/${created.id}/cancel`,
        headers: staff.mutationHeaders(),
      });
      expect(cancelSeated.statusCode).toBe(409);
      expect(cancelSeated.json().code).toBe("INVALID_STATE");
    } finally {
      await app.close();
    }
  });

  it("rejects malformed queries, invalid payloads, caller-supplied tenant fields and redacts internal errors", async () => {
    const staff = await issueStaffSession("orgA");
    const { app } = createTestApp();
    try {
      // Invalid availability and list queries -> 400 INVALID_REQUEST
      for (const badUrl of [
        `${base}/availability`,
        `${base}/availability?date=${date}`,
        `${base}/availability?partySize=2`,
        `${base}/availability?date=2026-02-30&partySize=2`,
        `${base}/availability?date=${date}&partySize=0`,
        `${base}/availability?date=${date}&partySize=51`,
        `${base}/availability?date=${date}&partySize=2&fromMinute=900&toMinute=800`,
        `${base}/availability?date=${date}&partySize=2&venueId=${f.a1}`,
        `${base}/availability?date=${date}&date=${date}&partySize=2`,
        `${base}`,
        `${base}?date=${date}&limit=0`,
        `${base}?date=${date}&limit=501`,
        `${base}?date=${date}&organizationId=${f.orgA}`,
        `${base}/not-a-uuid`,
        `${base}/${randomUUID()}?venueId=${f.a1}`,
      ]) {
        const res = await app.inject({
          method: "GET",
          url: badUrl,
          headers: staff.getHeaders(),
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({
          code: "INVALID_REQUEST",
          message: "Invalid request",
          requestId: expect.any(String),
        });
      }

      // Spoofed security fields or non-exact types on create/modify/check-in/cancel -> 400
      const validCreate = {
        date,
        partySize: 2,
        tableId,
        shiftId,
        startsAt: `${date}T18:00:00.000Z`,
        guestName: "Valid Name",
        guestEmail: "valid@example.test",
        idempotencyKey: randomUUID(),
      };
      for (const badBody of [
        { ...validCreate, organizationId: f.orgA },
        { ...validCreate, venueId: f.a1 },
        { ...validCreate, userId: f.identities.orgA.user },
        { ...validCreate, status: "SEATED" },
        { ...validCreate, partySize: "2" },
        { ...validCreate, guestName: "   " },
        { ...validCreate, guestEmail: "not-an-email" },
        { ...validCreate, startsAt: `${date}T18:00:00` },
      ]) {
        const res = await app.inject({
          method: "POST",
          url: base,
          headers: staff.mutationHeaders(),
          payload: badBody,
        });
        expect(res.statusCode).toBe(400);
      }

      const cancelWithSpoofedBody = await app.inject({
        method: "POST",
        url: `${base}/${randomUUID()}/cancel`,
        headers: staff.mutationHeaders(),
        payload: { venueId: f.a1 },
      });
      expect(cancelWithSpoofedBody.statusCode).toBe(400);

      // Unexpected database failure during reservation handler execution returns 500 without leaking SQL or PII
      const brokenPool = {
        connect: async () => {
          throw new Error(
            "SELECT * FROM projectx_test.reservations WHERE guest_email='canary-pii@example.test'",
          );
        },
        query: (text: string, values?: unknown[]) =>
          runtime.query(text, values),
      } as unknown as Pool;
      const broken = createTestApp(brokenPool);
      try {
        const failed = await broken.app.inject({
          method: "POST",
          url: base,
          headers: staff.mutationHeaders(),
          payload: {
            ...validCreate,
            guestName: "Canary Guest",
            guestEmail: "canary-pii@example.test",
          },
        });
        expect(failed.statusCode).toBe(500);
        expect(failed.json()).toEqual({
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
          requestId: expect.any(String),
        });
        const combined = failed.body + broken.logs.join("");
        expect(combined).not.toContain("canary-pii@example.test");
        expect(combined).not.toContain("Canary Guest");
        expect(combined).not.toContain("projectx_test.reservations");
        expect(combined).not.toContain(staff.credential);
      } finally {
        await broken.app.close();
      }
    } finally {
      await app.close();
    }
  });

  it("declares staff session, CSRF and context-version security contracts in OpenAPI", () => {
    const paths = specification.paths;
    for (const path of [
      "/api/v1/staff/reservations/availability",
      "/api/v1/staff/reservations",
      "/api/v1/staff/reservations/{id}",
      "/api/v1/staff/reservations/{id}/check-in",
      "/api/v1/staff/reservations/{id}/seat",
      "/api/v1/staff/reservations/{id}/cancel",
    ] as const) {
      expect(paths[path]).toBeDefined();
    }
    expect(paths["/api/v1/staff/reservations"].post.security).toEqual([
      { StaffSessionCookie: [] },
    ]);
    expect(paths["/api/v1/staff/reservations"].post.parameters).toEqual([
      { $ref: "#/components/parameters/StaffCsrf" },
      { $ref: "#/components/parameters/StaffContextVersion" },
    ]);
  });
});
