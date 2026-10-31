import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import specification from "../../../../packages/contracts/openapi.json" with {
  type: "json",
};
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import {
  bindVerifiedPeopleIdentity,
  withAuthorizedPeopleTransaction,
} from "../../src/people/authorization/context.js";
import { newPeopleId } from "../../src/people/persistence/id.js";
import type { PublicReservationsRateLimitConfig } from "../../src/reservations/public-route.js";
import {
  csrfFor,
  hash,
  SESSION_COOKIE,
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

const staffBase = "/api/v1/staff/reservations";
const publicBase = (slug = "oak-grill") => `/api/v1/public/venues/${slug}`;
const year = new Date().getUTCFullYear() + 2;
const date = `${year}-01-15`;
const slot1800 = `${date}T18:00:00.000Z`;
const slot1815 = `${date}T18:15:00.000Z`;

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

async function configurePublicVenue(options?: {
  org?: string;
  venue?: string;
  serviceDate?: string;
  timezone?: string;
  slug?: string | null;
  enabled?: boolean;
  firstCapacity?: number;
  secondCapacity?: number | null;
}) {
  const org = options?.org ?? f.orgA;
  const venue = options?.venue ?? f.a1;
  const serviceDate = options?.serviceDate ?? date;
  const timezone = options?.timezone ?? "America/Chicago";
  const slug = options?.slug === undefined ? "oak-grill" : options.slug;
  const enabled = options?.enabled ?? true;
  const firstCapacity = options?.firstCapacity ?? 2;
  const secondCapacity =
    options?.secondCapacity === undefined ? 4 : options.secondCapacity;

  const t1 = newPeopleId();
  const t2 = secondCapacity !== null ? newPeopleId() : null;
  const shift = newPeopleId();

  await adminPool.query(
    `INSERT INTO projectx_test.reservation_venue_settings(
      organization_id,venue_id,timezone,public_slug,public_booking_enabled
     ) VALUES($1,$2,$3,$4,$5)
     ON CONFLICT (organization_id,venue_id) DO UPDATE
       SET timezone=EXCLUDED.timezone,
           public_slug=EXCLUDED.public_slug,
           public_booking_enabled=EXCLUDED.public_booking_enabled`,
    [org, venue, timezone, slug, enabled],
  );
  await adminPool.query(
    "INSERT INTO projectx_test.reservation_tables(id,organization_id,venue_id,label,capacity,active) VALUES($1,$2,$3,'Table 1',$4,true)",
    [t1, org, venue, firstCapacity],
  );
  if (t2 && secondCapacity !== null) {
    await adminPool.query(
      "INSERT INTO projectx_test.reservation_tables(id,organization_id,venue_id,label,capacity,active) VALUES($1,$2,$3,'Table 2',$4,true)",
      [t2, org, venue, secondCapacity],
    );
  }
  await adminPool.query(
    "INSERT INTO projectx_test.reservation_shifts VALUES($1,$2,$3,$4,720,1020,60,15,1,6)",
    [shift, org, venue, serviceDate],
  );
  return { t1, t2: t2 ?? t1, shift };
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

function createTestApp(
  pool: Pool = runtime,
  rateLimit?: PublicReservationsRateLimitConfig,
) {
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
    publicReservations: {
      runtimePool: pool,
      expectedHost: new URL(authConfig.origin).host,
      ...(rateLimit ? { rateLimit } : {}),
    },
  });
  return { app, logs };
}

beforeAll(async () => {
  await freshPeopleFixture();
  const restrictedRuntime = await startRuntime();
  // Separate backend connections are essential: a one-connection pool serializes races.
  runtime = new Pool({ ...restrictedRuntime.options, max: 8 });
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
    f.orgB,
    f.b1,
    f.identities.orgB.access[0] ?? "",
    f.identities.orgB.user,
  );
  const configured = await configurePublicVenue();
  tableId = configured.t1;
  secondTableId = configured.t2;
  shiftId = configured.shift;
});

afterAll(async () => {
  await runtime?.end();
  await stopRuntime();
});

describe("RESERVATION-DOMAIN-007 public guest reservation API (ADR-0023)", () => {
  it("demonstrates public availability -> guest booking -> occupancy update -> immediate staff reservation book visibility and staff lifecycle actions", async () => {
    const { app } = createTestApp();
    await adminPool.query(
      "UPDATE projectx_test.reservation_tables SET active=false WHERE id=$1",
      [secondTableId],
    );

    const availabilityBefore = await app.inject({
      method: "GET",
      url: `${publicBase("oak-grill")}/availability?date=${date}&partySize=2&fromMinute=720&toMinute=780`,
      headers: { host: "app.test" },
    });
    expect(availabilityBefore.statusCode).toBe(200);
    expect(availabilityBefore.headers["cache-control"]).toBe("no-store");
    expect(availabilityBefore.headers["referrer-policy"]).toBe("no-referrer");

    const beforeBody = availabilityBefore.json();
    expect(beforeBody.venue).toEqual({
      slug: "oak-grill",
      name: "VENUE-A1",
      timezone: "America/Chicago",
    });
    expect(beforeBody.items).toHaveLength(4);
    expect(beforeBody.items[0]).toEqual({
      startsAt: slot1800,
      endsAt: `${date}T19:00:00.000Z`,
      timezone: "America/Chicago",
    });
    for (const slot of beforeBody.items) {
      expect(Object.keys(slot).sort()).toEqual([
        "endsAt",
        "startsAt",
        "timezone",
      ]);
      expect(slot).not.toHaveProperty("tableId");
      expect(slot).not.toHaveProperty("shiftId");
      expect(slot).not.toHaveProperty("organizationId");
      expect(slot).not.toHaveProperty("venueId");
    }

    const idempotencyKey = randomUUID();
    const createRes = await app.inject({
      method: "POST",
      url: `${publicBase("oak-grill")}/reservations`,
      headers: { host: "app.test", origin: authConfig.origin },
      payload: {
        date,
        partySize: 2,
        startsAt: slot1800,
        guestName: "  Maya Lin  ",
        guestEmail: "  maya.lin@example.invalid  ",
        idempotencyKey,
      },
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.headers["cache-control"]).toBe("no-store");
    expect(createRes.headers["referrer-policy"]).toBe("no-referrer");

    const confirmation = createRes.json();
    expect(confirmation).toEqual({
      reservationId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      venueSlug: "oak-grill",
      venueName: "VENUE-A1",
      date,
      startsAt: slot1800,
      endsAt: `${date}T19:00:00.000Z`,
      timezone: "America/Chicago",
      partySize: 2,
      guestName: "Maya Lin",
      status: "BOOKED",
      confirmationDelivery: "NONE",
    });
    expect(confirmation).not.toHaveProperty("organizationId");
    expect(confirmation).not.toHaveProperty("venueId");
    expect(confirmation).not.toHaveProperty("tableId");
    expect(confirmation).not.toHaveProperty("shiftId");
    expect(confirmation).not.toHaveProperty("guestEmail");

    // 60-minute reservation at 18:00 blocks 18:00, 18:15, 18:30, 18:45 on the single active table
    const availabilityAfter = await app.inject({
      method: "GET",
      url: `${publicBase("oak-grill")}/availability?date=${date}&partySize=2&fromMinute=720&toMinute=780`,
      headers: { host: "app.test" },
    });
    expect(availabilityAfter.statusCode).toBe(200);
    expect(availabilityAfter.json().items).toEqual([]);

    // Database record has created_by_user_id IS NULL and audit row has actor_user_id IS NULL
    const dbRow = await adminPool.query(
      "SELECT booking_source, public_confirmation, created_by_user_id, table_id, shift_id, status, revision FROM projectx_test.reservations WHERE id=$1",
      [confirmation.reservationId],
    );
    expect(dbRow.rows[0]).toEqual({
      booking_source: "PUBLIC_WIDGET",
      public_confirmation: confirmation,
      created_by_user_id: null,
      table_id: tableId,
      shift_id: shiftId,
      status: "BOOKED",
      revision: 1,
    });
    const auditRow = await adminPool.query(
      "SELECT action, actor_user_id, actor_kind FROM projectx_test.reservation_changes WHERE reservation_id=$1",
      [confirmation.reservationId],
    );
    expect(auditRow.rows).toEqual([
      { action: "CREATED", actor_user_id: null, actor_kind: "GUEST" },
    ]);

    // Immediate visibility in authenticated staff reservation book without duplicate records
    const staff = await issueStaffSession("orgA");
    const listRes = await app.inject({
      method: "GET",
      url: `${staffBase}?date=${date}`,
      headers: staff.getHeaders(),
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items).toHaveLength(1);
    expect(listRes.json().items[0]).toMatchObject({
      id: confirmation.reservationId,
      organizationId: f.orgA,
      venueId: f.a1,
      tableId,
      shiftId,
      guestName: "Maya Lin",
      guestEmail: "maya.lin@example.invalid",
      partySize: 2,
      status: "BOOKED",
      revision: 1,
    });

    // Authorized staff can modify, check in, and seat the guest-originated booking
    const modifyRes = await app.inject({
      method: "PATCH",
      url: `${staffBase}/${confirmation.reservationId}`,
      headers: staff.mutationHeaders(),
      payload: {
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
        date,
        startsAt: slot1815,
        tableId,
        shiftId,
        partySize: 2,
      },
    });
    expect(modifyRes.statusCode).toBe(200);
    expect(modifyRes.json()).toMatchObject({
      id: confirmation.reservationId,
      startsAt: slot1815,
      status: "BOOKED",
      revision: 2,
    });

    const checkInRes = await app.inject({
      method: "POST",
      url: `${staffBase}/${confirmation.reservationId}/check-in`,
      headers: staff.mutationHeaders(),
      payload: {
        expectedRevision: 2,
        idempotencyKey: randomUUID(),
      },
    });
    expect(checkInRes.statusCode).toBe(200);
    expect(checkInRes.json().status).toBe("CHECKED_IN");

    const seatRes = await app.inject({
      method: "POST",
      url: `${staffBase}/${confirmation.reservationId}/seat`,
      headers: staff.mutationHeaders(),
      payload: {
        expectedRevision: 3,
        idempotencyKey: randomUUID(),
      },
    });
    expect(seatRes.statusCode).toBe(200);
    expect(seatRes.json().status).toBe("SEATED");

    await app.close();
  });

  it("returns identical 404 NOT_FOUND for unknown, unconfigured, or public_booking_enabled=false Venues without tenant enumeration", async () => {
    const { app } = createTestApp();
    // Configure orgB/b1 with a slug but disabled
    await configurePublicVenue({
      org: f.orgB,
      venue: f.b1,
      slug: "hidden-bistro",
      enabled: false,
    });

    for (const slug of ["nonexistent-venue", "hidden-bistro"]) {
      const getRes = await app.inject({
        method: "GET",
        url: `${publicBase(slug)}/availability?date=${date}&partySize=2`,
        headers: { host: "app.test" },
      });
      expect(getRes.statusCode).toBe(404);
      expect(getRes.json()).toEqual({
        code: "NOT_FOUND",
        message: "Resource not found",
        requestId: expect.any(String),
      });

      const postRes = await app.inject({
        method: "POST",
        url: `${publicBase(slug)}/reservations`,
        headers: { host: "app.test", origin: authConfig.origin },
        payload: {
          date,
          partySize: 2,
          startsAt: slot1800,
          guestName: "Test Guest",
          guestEmail: "guest@example.invalid",
          idempotencyKey: randomUUID(),
        },
      });
      expect(postRes.statusCode).toBe(404);
      expect(postRes.json()).toEqual({
        code: "NOT_FOUND",
        message: "Resource not found",
        requestId: expect.any(String),
      });
    }

    // Disabling oak-grill immediately blocks both availability and booking with 404
    await adminPool.query(
      "UPDATE projectx_test.reservation_venue_settings SET public_booking_enabled=false WHERE venue_id=$1",
      [f.a1],
    );
    const disabledGet = await app.inject({
      method: "GET",
      url: `${publicBase("oak-grill")}/availability?date=${date}&partySize=2`,
      headers: { host: "app.test" },
    });
    expect(disabledGet.statusCode).toBe(404);

    await app.close();
  });

  it("allocates deterministic best-fit table, falls back to second table, and prevents double-booking under concurrency", async () => {
    const { app } = createTestApp();

    // tableId has capacity 2; secondTableId has capacity 4.
    // Two concurrent guest bookings for partySize=2 at slot1800 should both succeed on distinct tables.
    const [first, second] = await Promise.all([
      app.inject({
        method: "POST",
        url: `${publicBase("oak-grill")}/reservations`,
        headers: { host: "app.test", origin: authConfig.origin },
        payload: {
          date,
          partySize: 2,
          startsAt: slot1800,
          guestName: "Guest One",
          guestEmail: "one@example.invalid",
          idempotencyKey: randomUUID(),
        },
      }),
      app.inject({
        method: "POST",
        url: `${publicBase("oak-grill")}/reservations`,
        headers: { host: "app.test", origin: authConfig.origin },
        payload: {
          date,
          partySize: 2,
          startsAt: slot1800,
          guestName: "Guest Two",
          guestEmail: "two@example.invalid",
          idempotencyKey: randomUUID(),
        },
      }),
    ]);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);

    const assigned = await adminPool.query(
      "SELECT table_id FROM projectx_test.reservations WHERE venue_id=$1 ORDER BY table_id",
      [f.a1],
    );
    expect(assigned.rows.map((r) => r.table_id).sort()).toEqual(
      [tableId, secondTableId].sort(),
    );

    // Third booking for the same slot must fail with 409 CAPACITY_CONFLICT
    const third = await app.inject({
      method: "POST",
      url: `${publicBase("oak-grill")}/reservations`,
      headers: { host: "app.test", origin: authConfig.origin },
      payload: {
        date,
        partySize: 2,
        startsAt: slot1800,
        guestName: "Guest Three",
        guestEmail: "three@example.invalid",
        idempotencyKey: randomUUID(),
      },
    });
    expect(third.statusCode).toBe(409);
    expect(third.json().code).toBe("CAPACITY_CONFLICT");

    // Single-table race at 19:00 UTC for partySize=4 (only secondTableId fits partySize=4)
    const slot1900 = `${date}T19:00:00.000Z`;
    const race = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        app.inject({
          method: "POST",
          url: `${publicBase("oak-grill")}/reservations`,
          headers: { host: "app.test", origin: authConfig.origin },
          payload: {
            date,
            partySize: 4,
            startsAt: slot1900,
            guestName: `Racer ${i}`,
            guestEmail: `racer${i}@example.invalid`,
            idempotencyKey: randomUUID(),
          },
        }),
      ),
    );
    const statuses = race.map((r) => r.statusCode).sort();
    expect(statuses).toEqual([201, 409, 409, 409]);

    await app.close();
  });

  it("enforces Venue-scoped guest idempotency, preserves original confirmation snapshot after staff changes, and rejects mismatched retries with 409 IDEMPOTENCY_CONFLICT", async () => {
    const { app } = createTestApp();
    await configurePublicVenue({
      org: f.orgB,
      venue: f.b1,
      slug: "pine-bistro",
      enabled: true,
    });

    const key = randomUUID();
    const payload = {
      date,
      partySize: 2,
      startsAt: slot1800,
      guestName: "Jordan Taylor",
      guestEmail: "Jordan.Taylor@Example.Invalid",
      idempotencyKey: key,
    };

    // Concurrent identical requests with same idempotencyKey produce a single reservation
    const [r1, r2] = await Promise.all([
      app.inject({
        method: "POST",
        url: `${publicBase("oak-grill")}/reservations`,
        headers: { host: "app.test", origin: authConfig.origin },
        payload,
      }),
      app.inject({
        method: "POST",
        url: `${publicBase("oak-grill")}/reservations`,
        headers: { host: "app.test", origin: authConfig.origin },
        payload: {
          ...payload,
          guestEmail: "jordan.taylor@example.invalid",
        },
      }),
    ]);
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    expect(r1.json()).toEqual(r2.json());

    const originalSnapshot = r1.json();
    await adminPool.query(
      "UPDATE projectx_test.venues SET name='Renamed Venue' WHERE id=$1",
      [f.a1],
    );

    // Staff modifies and cancels the booking; guest idempotent retry still returns original BOOKED snapshot
    const staff = await issueStaffSession("orgA");
    const mod = await app.inject({
      method: "PATCH",
      url: `${staffBase}/${originalSnapshot.reservationId}`,
      headers: staff.mutationHeaders(),
      payload: {
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
        date,
        startsAt: slot1815,
        tableId,
        shiftId,
        partySize: 2,
      },
    });
    expect(mod.statusCode).toBe(200);

    const cancel = await app.inject({
      method: "POST",
      url: `${staffBase}/${originalSnapshot.reservationId}/cancel`,
      headers: staff.mutationHeaders(),
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json().status).toBe("CANCELLED");

    const replayAfterStaffChanges = await app.inject({
      method: "POST",
      url: `${publicBase("oak-grill")}/reservations`,
      headers: { host: "app.test", origin: authConfig.origin },
      payload,
    });
    expect(replayAfterStaffChanges.statusCode).toBe(201);
    expect(replayAfterStaffChanges.json()).toEqual(originalSnapshot);

    // Same key with any altered parameter fails 409 IDEMPOTENCY_CONFLICT
    const mismatch = await app.inject({
      method: "POST",
      url: `${publicBase("oak-grill")}/reservations`,
      headers: { host: "app.test", origin: authConfig.origin },
      payload: { ...payload, partySize: 3 },
    });
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().code).toBe("IDEMPOTENCY_CONFLICT");

    // Reusing the exact same idempotencyKey at a different Venue succeeds independently
    const otherVenue = await app.inject({
      method: "POST",
      url: `${publicBase("pine-bistro")}/reservations`,
      headers: { host: "app.test", origin: authConfig.origin },
      payload: { ...payload, partySize: 4 },
    });
    expect(otherVenue.statusCode).toBe(201);
    expect(otherVenue.json().venueSlug).toBe("pine-bistro");
    expect(otherVenue.json().reservationId).not.toBe(
      originalSnapshot.reservationId,
    );

    await app.close();
  });

  it("enforces database grants, RLS, anti-forgery call-stack guards, and atomic rollback on audit failure", async () => {
    // 1. Direct runtime queries without staff context cannot read or insert reservations
    const client = await runtime.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL search_path TO projectx_test, public");
      const visible = await client.query("SELECT id FROM reservations");
      expect(visible.rowCount).toBe(0);

      await expect(
        client.query(
          `INSERT INTO reservations(
            id,organization_id,venue_id,client_id,table_id,shift_id,
            guest_name,guest_email,party_size,starts_at,ends_at,local_date,timezone,
            status,created_by_user_id,idempotency_key,request_fingerprint,booking_source,public_confirmation
          ) VALUES($1,$2,$3,$4,$5,$6,'Forged','forged@example.invalid',2,$7,$8,$9,'America/Chicago','BOOKED',NULL,$10,'abc','PUBLIC_WIDGET','{}')`,
          [
            newPeopleId(),
            f.orgA,
            f.a1,
            newPeopleId(),
            tableId,
            shiftId,
            slot1800,
            `${date}T19:00:00.000Z`,
            date,
            randomUUID(),
          ],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    // 2. Even an authorized staff session with reservation.create cannot forge a guest row (created_by_user_id IS NULL)
    //    even if it sets projectx.public_booking_guard manually
    await expect(
      withAuthorizedPeopleTransaction(
        runtime,
        bindVerifiedPeopleIdentity(f.identities.orgA.user),
        {
          organizationId: f.orgA,
          venueId: f.a1,
          permissionId: "reservation.create",
        },
        async (scopedClient) => {
          const forgedId = newPeopleId();
          const forgedClient = newPeopleId();
          await scopedClient.query(
            "SELECT set_config('projectx.public_booking_guard',$1,true)",
            [`${forgedId}:forged-fp`],
          );
          await scopedClient.query(
            "INSERT INTO reservation_clients(id,organization_id) VALUES($1,$2)",
            [forgedClient, f.orgA],
          );
          await scopedClient.query(
            `INSERT INTO reservations(
              id,organization_id,venue_id,client_id,table_id,shift_id,
              guest_name,guest_email,party_size,starts_at,ends_at,local_date,timezone,
              status,created_by_user_id,idempotency_key,request_fingerprint,booking_source,public_confirmation
            ) VALUES($1,$2,$3,$4,$5,$6,'Forged','forged@example.invalid',2,$7,$8,$9,'America/Chicago','BOOKED',NULL,$10,'forged-fp','PUBLIC_WIDGET','{}')`,
            [
              forgedId,
              f.orgA,
              f.a1,
              forgedClient,
              tableId,
              shiftId,
              slot1800,
              `${date}T19:00:00.000Z`,
              date,
              randomUUID(),
            ],
          );
        },
      ),
    ).rejects.toMatchObject({ code: "42501" });

    // 3. Verify SECURITY DEFINER metadata and grants on public functions
    const fnMeta = await adminPool.query(
      `SELECT p.proname, p.prosecdef, p.proconfig,
              has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec,
              has_function_privilege('projectx_people_runtime', p.oid, 'EXECUTE') AS runtime_exec
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'projectx_test'
          AND p.proname IN ('reservation_public_availability', 'reservation_public_create')
        ORDER BY p.proname`,
    );
    expect(fnMeta.rows).toEqual([
      {
        proname: "reservation_public_availability",
        prosecdef: true,
        proconfig: ["search_path=projectx_test, pg_catalog, pg_temp"],
        public_exec: false,
        runtime_exec: true,
      },
      {
        proname: "reservation_public_create",
        prosecdef: true,
        proconfig: ["search_path=projectx_test, pg_catalog, pg_temp"],
        public_exec: false,
        runtime_exec: true,
      },
    ]);

    // 4. Atomic rollback on audit failure leaves zero reservation_clients or reservations rows
    await adminPool.query(
      `CREATE OR REPLACE FUNCTION projectx_test.reservation_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN RAISE EXCEPTION 'forced audit failure'; END $$`,
    );
    await adminPool.query(
      "CREATE TRIGGER z_fail_audit BEFORE INSERT ON projectx_test.reservation_changes FOR EACH ROW EXECUTE FUNCTION projectx_test.reservation_fail_audit()",
    );
    try {
      const { app, logs } = createTestApp();
      const res = await app.inject({
        method: "POST",
        url: `${publicBase("oak-grill")}/reservations`,
        headers: { host: "app.test", origin: authConfig.origin },
        payload: {
          date,
          partySize: 2,
          startsAt: slot1800,
          guestName: "Rollback Guest",
          guestEmail: "rollback@example.invalid",
          idempotencyKey: randomUUID(),
        },
      });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId: expect.any(String),
      });
      const joinedLogs = logs.join("\n");
      expect(joinedLogs).not.toContain("Rollback Guest");
      expect(joinedLogs).not.toContain("rollback@example.invalid");
      expect(joinedLogs).not.toContain("forced audit failure");

      const clientsCount = await adminPool.query(
        "SELECT count(*)::int AS count FROM projectx_test.reservation_clients",
      );
      const bookingsCount = await adminPool.query(
        "SELECT count(*)::int AS count FROM projectx_test.reservations",
      );
      expect(clientsCount.rows[0].count).toBe(0);
      expect(bookingsCount.rows[0].count).toBe(0);
      await app.close();
    } finally {
      await adminPool.query(
        "DROP TRIGGER IF EXISTS z_fail_audit ON projectx_test.reservation_changes",
      );
      await adminPool.query(
        "DROP FUNCTION IF EXISTS projectx_test.reservation_fail_audit()",
      );
    }
  });

  it("enforces Host/X-Forwarded-Host/Origin boundaries, strict input validation, rate limiting, and no public read/modify/cancel by ID", async () => {
    let clock = 1_000_000;
    const { app } = createTestApp(runtime, {
      maxRequests: 3,
      windowMs: 60_000,
      now: () => clock,
    });

    // X-Forwarded-Host is rejected with 403
    const forwardedHost = await app.inject({
      method: "GET",
      url: `${publicBase("oak-grill")}/availability?date=${date}&partySize=2`,
      headers: { host: "app.test", "x-forwarded-host": "evil.invalid" },
    });
    expect(forwardedHost.statusCode).toBe(403);

    // Mismatched Host is rejected with 403
    const badHost = await app.inject({
      method: "GET",
      url: `${publicBase("oak-grill")}/availability?date=${date}&partySize=2`,
      headers: { host: "evil.invalid" },
    });
    expect(badHost.statusCode).toBe(403);

    // Mismatched Origin on POST is rejected with 403
    const badOrigin = await app.inject({
      method: "POST",
      url: `${publicBase("oak-grill")}/reservations`,
      headers: { host: "app.test", origin: "https://evil.invalid" },
      payload: {
        date,
        partySize: 2,
        startsAt: slot1800,
        guestName: "Guest",
        guestEmail: "guest@example.invalid",
        idempotencyKey: randomUUID(),
      },
    });
    expect(badOrigin.statusCode).toBe(403);

    // Forbidden extra fields (tableId, shiftId, organizationId, venueId) are rejected with 400
    for (const extra of [
      { tableId },
      { shiftId },
      { organizationId: f.orgA },
      { venueId: f.a1 },
    ]) {
      clock += 61_000;
      const forbiddenField = await app.inject({
        method: "POST",
        url: `${publicBase("oak-grill")}/reservations`,
        headers: { host: "app.test", origin: authConfig.origin },
        payload: {
          date,
          partySize: 2,
          startsAt: slot1800,
          guestName: "Guest",
          guestEmail: "guest@example.invalid",
          idempotencyKey: randomUUID(),
          ...extra,
        },
      });
      expect(forbiddenField.statusCode).toBe(400);
      expect(forbiddenField.json().code).toBe("INVALID_REQUEST");
    }

    // No public GET/PATCH/POST by reservation ID exists (returns 404)
    const randomId = randomUUID();
    for (const method of ["GET", "PATCH", "POST"] as const) {
      const res = await app.inject({
        method,
        url: `${publicBase("oak-grill")}/reservations/${randomId}`,
        headers: { host: "app.test" },
      });
      expect(res.statusCode).toBe(404);
    }

    // Rate limiting per IP + venueSlug (maxRequests = 3 within 60s window)
    clock += 61_000;
    for (let i = 0; i < 3; i += 1) {
      const ok = await app.inject({
        method: "GET",
        url: `${publicBase("oak-grill")}/availability?date=${date}&partySize=2`,
        headers: {
          host: "app.test",
          "x-forwarded-for": `203.0.113.${i + 1}`,
        },
      });
      expect(ok.statusCode).toBe(200);
    }
    // 4th request in same window fails 429 even when spoofing X-Forwarded-For
    const limited = await app.inject({
      method: "GET",
      url: `${publicBase("oak-grill")}/availability?date=${date}&partySize=2`,
      headers: {
        host: "app.test",
        "x-forwarded-for": "198.51.100.99",
      },
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({
      code: "RATE_LIMITED",
      message: "Too many requests",
      requestId: expect.any(String),
    });

    // Advancing past window resets rate limit
    clock += 61_000;
    const resetOk = await app.inject({
      method: "GET",
      url: `${publicBase("oak-grill")}/availability?date=${date}&partySize=2`,
      headers: { host: "app.test" },
    });
    expect(resetOk.statusCode).toBe(200);

    // OpenAPI contract documents both public endpoints with empty security array
    expect(
      specification.paths["/api/v1/public/venues/{venueSlug}/availability"].get
        .security,
    ).toEqual([]);
    expect(
      specification.paths["/api/v1/public/venues/{venueSlug}/reservations"].post
        .security,
    ).toEqual([]);

    await app.close();
  });
  it("rejects invalid fields and duplicate query parameters without writing", async () => {
    const { app } = createTestApp();
    const payload = {
      date,
      partySize: 2,
      startsAt: slot1800,
      guestName: "Guest",
      guestEmail: "guest@example.invalid",
      idempotencyKey: randomUUID(),
    };
    for (const invalid of [
      { guestName: "bad\u0000name" },
      { guestEmail: "invalid" },
      { date: `${year}-02-30` },
      { startsAt: slot1800.replace(".000Z", ".123Z") },
      { partySize: 0 },
      { idempotencyKey: "not-uuid" },
    ]) {
      const result = await app.inject({
        method: "POST",
        url: `${publicBase()}/reservations`,
        headers: { host: "app.test" },
        payload: { ...payload, ...invalid },
      });
      expect(result.statusCode).toBe(400);
    }
    const duplicate = await app.inject({
      method: "GET",
      url:
        publicBase() +
        "/availability?date=" +
        date +
        "&partySize=2&partySize=4",
      headers: { host: "app.test" },
    });
    expect(duplicate.statusCode).toBe(400);
    expect(
      (
        await adminPool.query(
          "SELECT count(*)::int AS n FROM projectx_test.reservations",
        )
      ).rows[0].n,
    ).toBe(0);
    await app.close();
  });

  it("keeps the persisted confirmation immutable through check-in and seating", async () => {
    const { app } = createTestApp();
    const payload = {
      date,
      partySize: 2,
      startsAt: slot1800,
      guestName: "Guest",
      guestEmail: "guest@example.invalid",
      idempotencyKey: randomUUID(),
    };
    const book = () =>
      app.inject({
        method: "POST",
        url: `${publicBase()}/reservations`,
        headers: { host: "app.test" },
        payload,
      });
    const first = await book();
    expect(first.statusCode).toBe(201);
    const staff = await issueStaffSession();
    for (const [action, expectedRevision] of [
      ["check-in", 1],
      ["seat", 2],
    ] as const) {
      const result = await app.inject({
        method: "POST",
        url: `${staffBase}/${first.json().reservationId}/${action}`,
        headers: staff.mutationHeaders(),
        payload: { expectedRevision, idempotencyKey: randomUUID() },
      });
      expect(result.statusCode).toBe(200);
      expect((await book()).json()).toEqual(first.json());
    }
    const client = await runtime.connect();
    try {
      await expect(
        client.query(
          "UPDATE projectx_test.reservations SET public_confirmation='{}' WHERE id=$1",
          [first.json().reservationId],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      client.release();
    }
    await app.close();
  });
  it("enforces explicit staff/guest schema constraints and restricted function/table privileges", async () => {
    const result = await adminPool.query(
      "SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='projectx_test'::regnamespace AND conname IN ('reservations_booking_actor','reservation_changes_actor') ORDER BY conname",
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].definition).toContain("actor_kind");
    expect(result.rows[1].definition).toContain("booking_source");
    const policy = await adminPool.query(
      "SELECT permissive,with_check FROM pg_policies WHERE schemaname='projectx_test' AND policyname='reservations_staff_insert_source'",
    );
    expect(policy.rows).toHaveLength(1);
    expect(policy.rows[0].permissive).toBe("RESTRICTIVE");
    expect(policy.rows[0].with_check).toContain("booking_source = 'STAFF'");
    const privileges = await adminPool.query(
      "SELECT has_table_privilege('projectx_people_runtime','projectx_test.reservation_changes','INSERT') AS audit_insert,has_column_privilege('projectx_people_runtime','projectx_test.reservations','public_confirmation','UPDATE') AS snapshot_update,has_schema_privilege('projectx_people_runtime','projectx_test','CREATE') AS schema_create",
    );
    expect(privileges.rows[0]).toEqual({
      audit_insert: false,
      snapshot_update: false,
      schema_create: false,
    });
    const { app } = createTestApp();
    const created = await app.inject({
      method: "POST",
      url: `${publicBase()}/reservations`,
      headers: { host: "app.test" },
      payload: {
        date,
        partySize: 2,
        startsAt: slot1800,
        guestName: "Guest",
        guestEmail: "guest@example.invalid",
        idempotencyKey: randomUUID(),
      },
    });
    expect(created.statusCode).toBe(201);
    // A mismatched discriminator cannot be silently rewritten, including by an owner SQL update.
    await expect(
      adminPool.query(
        "UPDATE projectx_test.reservations SET booking_source='STAFF' WHERE id=$1",
        [created.json().reservationId],
      ),
    ).rejects.toBeDefined();
    await app.close();
  });

  it("preserves the existing DST fold/gap policy without leaking another venue", async () => {
    const firstNovember = new Date(Date.UTC(year, 10, 1));
    const sunday = 1 + ((7 - firstNovember.getUTCDay()) % 7);
    const fallDay = `${year}-11-${String(sunday).padStart(2, "0")}`;
    await configurePublicVenue({
      serviceDate: fallDay,
      slug: "dst-venue",
      venue: f.b1,
      org: f.orgB,
      secondCapacity: null,
    });
    await adminPool.query(
      "UPDATE projectx_test.reservation_shifts SET open_minute=60,close_minute=180,duration_minutes=30,step_minutes=30 WHERE venue_id=$1",
      [f.b1],
    );
    const { app } = createTestApp();
    const found = await app.inject({
      method: "GET",
      url: `${publicBase("dst-venue")}/availability?date=${fallDay}&partySize=2`,
      headers: { host: "app.test" },
    });
    expect(found.statusCode).toBe(200);
    const slots = found.json().items as {
      startsAt: string;
      endsAt: string;
      timezone: string;
    }[];
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => slot.timezone === "America/Chicago")).toBe(
      true,
    );
    expect(new Set(slots.map((slot) => slot.startsAt)).size).toBe(slots.length);
    const created = await app.inject({
      method: "POST",
      url: `${publicBase("dst-venue")}/reservations`,
      headers: { host: "app.test" },
      payload: {
        date: fallDay,
        partySize: 2,
        startsAt: slots[0]?.startsAt,
        guestName: "DST Guest",
        guestEmail: "dst@example.invalid",
        idempotencyKey: randomUUID(),
      },
    });
    expect(created.statusCode).toBe(201);
    const staff = await issueStaffSession("orgA");
    const hidden = await app.inject({
      method: "GET",
      url: `${staffBase}/${created.json().reservationId}`,
      headers: staff.getHeaders(),
    });
    expect(hidden.statusCode).toBe(404);
    const springFirst = new Date(Date.UTC(year, 2, 1));
    const springDay = `${year}-03-${String(8 + ((7 - springFirst.getUTCDay()) % 7)).padStart(2, "0")}`;
    await configurePublicVenue({
      serviceDate: springDay,
      slug: "spring-venue",
      venue: f.a2,
      org: f.orgA,
      secondCapacity: null,
    });
    await adminPool.query(
      "UPDATE projectx_test.reservation_shifts SET open_minute=120,close_minute=240 WHERE venue_id=$1",
      [f.a2],
    );
    const gap = await app.inject({
      method: "GET",
      url: `${publicBase("spring-venue")}/availability?date=${springDay}&partySize=2`,
      headers: { host: "app.test" },
    });
    expect(gap.statusCode).toBe(200);
    expect(gap.json().items).toEqual([]);
    await app.close();
  });
});
