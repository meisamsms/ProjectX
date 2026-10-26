import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import {
  bindVerifiedPeopleIdentity,
  withAuthorizedPeopleTransaction,
} from "../../src/people/authorization/context.js";
import { newPeopleId } from "../../src/people/persistence/id.js";
import {
  type CreateReservation,
  cancelReservation,
  checkInReservation,
  createReservation,
  getReservation,
  type LifecycleTransition,
  listReservations,
  modifyReservation,
  type ModifyReservation,
  type Reservation,
  type ReservationScope,
  searchAvailability,
  seatReservation,
} from "../../src/reservations/service.js";
import { migrateTestDatabase } from "../database/migrate.js";
import {
  adminPool,
  freshPeopleFixture,
  rawScoped,
  startRuntime,
  stopRuntime,
} from "../people/fixtures/runtime.js";

let f: Awaited<ReturnType<typeof freshPeopleFixture>>;
let runtime: Pool;
let tableId: string, shiftId: string;
const year = new Date().getUTCFullYear() + 2;
const date = `${year}-01-15`;
const start = `${date}T18:00:00.000Z`; // noon America/Chicago
const scope = (
  actor: keyof typeof f.identities = "orgA",
  org = f.orgA,
  venue = f.a1,
): ReservationScope => ({
  identity: bindVerifiedPeopleIdentity(f.identities[actor].user),
  organizationId: org,
  venueId: venue,
});
const query = () => ({ date, partySize: 2, fromMinute: 720, toMinute: 780 });
const command = (
  overrides: Partial<CreateReservation> = {},
): CreateReservation => ({
  date,
  partySize: 2,
  tableId,
  shiftId,
  startsAt: start,
  guestName: "Synthetic Guest",
  guestEmail: "guest@example.invalid",
  idempotencyKey: crypto.randomUUID(),
  ...overrides,
});
async function grant(
  actor: keyof typeof f.identities,
  org: string,
  venue: string,
  access: string,
) {
  for (const permission of [
    "reservation.read",
    "reservation.create",
    "reservation.cancel",
  ])
    await adminPool.query(
      `INSERT INTO projectx_test.venue_permission_grants(id,organization_id,venue_id,venue_access_id,permission_id,granted_by_user_id) VALUES($1,$2,$3,$4,$5,$6)`,
      [newPeopleId(), org, venue, access, permission, f.identities[actor].user],
    );
}
async function configure(
  org = f.orgA,
  venue = f.a1,
  localDate = date,
  open = 720,
  close = 840,
  duration = 60,
  step = 15,
  zone = "America/Chicago",
) {
  await adminPool.query(
    "INSERT INTO projectx_test.reservation_venue_settings VALUES($1,$2,$3) ON CONFLICT(organization_id,venue_id) DO UPDATE SET timezone=excluded.timezone",
    [org, venue, zone],
  );
  const table = newPeopleId(),
    shift = newPeopleId();
  await adminPool.query(
    "INSERT INTO projectx_test.reservation_tables(id,organization_id,venue_id,label,capacity) VALUES($1,$2,$3,'Test table',2)",
    [table, org, venue],
  );
  await adminPool.query(
    "INSERT INTO projectx_test.reservation_shifts VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,6)",
    [shift, org, venue, localDate, open, close, duration, step],
  );
  return { table, shift };
}
async function counts() {
  return (
    await adminPool.query(
      `SELECT (SELECT count(*)::int FROM projectx_test.reservations) bookings,(SELECT count(*)::int FROM projectx_test.reservation_clients) clients,(SELECT count(*)::int FROM projectx_test.reservation_changes) changes`,
    )
  ).rows[0];
}
async function raw(client: PoolClient, s = scope()) {
  await client.query("BEGIN");
  await rawScoped(
    client,
    s.identity.userId,
    s.organizationId,
    s.venueId,
    "venue",
  );
}
async function rawInsert(
  client: PoolClient,
  at = start,
  until = `${date}T19:00:00.000Z`,
  table = tableId,
) {
  const cid = newPeopleId();
  await client.query(
    "INSERT INTO projectx_test.reservation_clients(id,organization_id) VALUES($1,$2)",
    [cid, f.orgA],
  );
  return client.query(
    `INSERT INTO projectx_test.reservations(id,organization_id,venue_id,client_id,table_id,shift_id,guest_name,guest_email,party_size,starts_at,ends_at,local_date,timezone,created_by_user_id,idempotency_key,request_fingerprint)
    VALUES($1,$2,$3,$4,$5,$6,'Synthetic Guest','raw@example.invalid',2,$7,$8,$9,'America/Chicago',$10,$11,$12)`,
    [
      newPeopleId(),
      f.orgA,
      f.a1,
      cid,
      table,
      shiftId,
      at,
      until,
      date,
      f.identities.orgA.user,
      crypto.randomUUID(),
      "a".repeat(64),
    ],
  );
}
beforeAll(async () => {
  f = await freshPeopleFixture();
  const single = await startRuntime();
  runtime = new Pool({ ...single.options, max: 4 });
});
beforeEach(async () => {
  f = await freshPeopleFixture();
  await grant("orgA", f.orgA, f.a1, f.orgAdminAccess);
  const a2 = f.identities.a2Only.access[0],
    b1 = f.identities.orgB.access[0];
  if (!a2 || !b1) throw Error("fixture access missing");
  await grant("a2Only", f.orgA, f.a2, a2);
  await grant("orgB", f.orgB, f.b1, b1);
  const configured = await configure();
  tableId = configured.table;
  shiftId = configured.shift;
});
afterAll(async () => {
  await runtime?.end();
  await stopRuntime();
});

describe("RESERVATION-DOMAIN-001 real PostgreSQL16", () => {
  it("DEMONSTRATION: search → select → create → unavailable → staff read → cancel → available", async () => {
    await adminPool.query(
      "UPDATE projectx_test.venues SET name='Test Restaurant' WHERE id=$1",
      [f.a1],
    );
    const before = await searchAvailability(runtime, scope(), query());
    const selected = before.find((s) => s.startsAt === start);
    expect(selected).toBeDefined();
    if (!selected) throw Error("missing demonstration slot");
    const booking = await createReservation(
      runtime,
      scope(),
      command({ ...selected }),
    );
    expect(
      (await searchAvailability(runtime, scope(), query())).some(
        (s) => s.startsAt === start,
      ),
    ).toBe(false);
    expect(await getReservation(runtime, scope(), booking.id)).toEqual(booking);
    expect(
      (await listReservations(runtime, scope(), date)).map((r) => r.id),
    ).toEqual([booking.id]);
    expect((await cancelReservation(runtime, scope(), booking.id)).status).toBe(
      "CANCELLED",
    );
    expect(await searchAvailability(runtime, scope(), query())).toEqual(before);
    expect(await counts()).toEqual({ bookings: 1, clients: 1, changes: 2 });
    console.log(
      "Synthetic domain demo PASS: search/create/occupied/staff-read/cancel/restored; no HTTP or external confirmation.",
    );
  });
  it("offers only eligible active table capacity within the requested local window", async () => {
    expect((await searchAvailability(runtime, scope(), query())).length).toBe(
      4,
    );
    expect(
      await searchAvailability(runtime, scope(), { ...query(), partySize: 3 }),
    ).toEqual([]);
    expect(
      await searchAvailability(runtime, scope(), {
        ...query(),
        fromMinute: 600,
        toMinute: 700,
      }),
    ).toEqual([]);
    await expect(
      createReservation(runtime, scope(), command({ partySize: 3 })),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
    await adminPool.query(
      "UPDATE projectx_test.reservation_tables SET active=false WHERE id=$1",
      [tableId],
    );
    expect(await searchAvailability(runtime, scope(), query())).toEqual([]);
  });
  it("revalidates the selected slot after configuration changes", async () => {
    expect(
      (await searchAvailability(runtime, scope(), query())).length,
    ).toBeGreaterThan(0);
    await adminPool.query(
      "UPDATE projectx_test.reservation_tables SET capacity=1 WHERE id=$1",
      [tableId],
    );
    await expect(
      createReservation(runtime, scope(), command()),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
    expect(await counts()).toEqual({ bookings: 0, clients: 0, changes: 0 });
  });
  it("rejects shifted/nonconfigured instants and never trusts supplied end time", async () => {
    await expect(
      createReservation(
        runtime,
        scope(),
        command({ startsAt: `${date}T18:01:00Z` }),
      ),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
    await expect(
      createReservation(
        runtime,
        scope(),
        command({ startsAt: `${date}T17:00:00Z` }),
      ),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
  });
  it("prevents overlapping but allows exactly adjacent half-open intervals", async () => {
    await createReservation(runtime, scope(), command());
    await expect(
      createReservation(
        runtime,
        scope(),
        command({ startsAt: `${date}T18:15:00Z` }),
      ),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
    await createReservation(
      runtime,
      scope(),
      command({ startsAt: `${date}T19:00:00Z` }),
    );
    expect((await counts()).bookings).toBe(2);
    expect((await counts()).clients).toBe(2);
  });
  it("two concurrent domain commands have exactly one conflicting winner", async () => {
    const results = await Promise.allSettled([
      createReservation(runtime, scope(), command()),
      createReservation(runtime, scope(), command()),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "CAPACITY_CONFLICT" },
    });
    expect(await counts()).toEqual({ bookings: 1, clients: 1, changes: 1 });
  });
  it("database exclusion protects two distinct raw runtime connections", async () => {
    const a = await runtime.connect(),
      b = await runtime.connect();
    try {
      expect(
        (await a.query("SELECT pg_backend_pid() pid")).rows[0].pid,
      ).not.toBe((await b.query("SELECT pg_backend_pid() pid")).rows[0].pid);
      await raw(a);
      await raw(b);
      await rawInsert(a);
      const second = rawInsert(b).then(
        () => ({ code: "unexpected success" }),
        (e) => ({ code: e.code }),
      );
      await a.query("COMMIT");
      expect(await second).toEqual({ code: "23P01" });
    } finally {
      await a.query("ROLLBACK");
      await b.query("ROLLBACK");
      a.release();
      b.release();
    }
    expect(await counts()).toEqual({ bookings: 1, clients: 1, changes: 1 });
  });
  it("same-key sequential/concurrent retries replay exactly one record", async () => {
    const input = command();
    const results = await Promise.all([
      createReservation(runtime, scope(), input),
      createReservation(runtime, scope(), input),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await createReservation(runtime, scope(), input)).toEqual(
      results[0],
    );
    expect(await counts()).toEqual({ bookings: 1, clients: 1, changes: 1 });
    await expect(
      createReservation(runtime, scope(), { ...input, guestName: "Other" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
  it("cancel and retry are idempotent without reactivating capacity", async () => {
    const input = command(),
      created = await createReservation(runtime, scope(), input);
    const cancelled = await cancelReservation(runtime, scope(), created.id);
    expect(await cancelReservation(runtime, scope(), created.id)).toEqual(
      cancelled,
    );
    expect(await createReservation(runtime, scope(), input)).toEqual(cancelled);
    expect((await searchAvailability(runtime, scope(), query())).length).toBe(
      4,
    );
    expect(await counts()).toEqual({ bookings: 1, clients: 1, changes: 2 });
  });
  it("supports independent capacity on another table", async () => {
    const other = newPeopleId();
    await adminPool.query(
      "INSERT INTO projectx_test.reservation_tables VALUES($1,$2,$3,'Second',2,true)",
      [other, f.orgA, f.a1],
    );
    await Promise.all([
      createReservation(runtime, scope(), command()),
      createReservation(runtime, scope(), command({ tableId: other })),
    ]);
    expect((await counts()).bookings).toBe(2);
  });
  it("denies organization and venue swaps, even with known record IDs", async () => {
    const created = await createReservation(runtime, scope(), command());
    await expect(
      getReservation(runtime, scope("orgA", f.orgB, f.b1), created.id),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await expect(
      getReservation(runtime, scope("orgA", f.orgA, f.a2), created.id),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    for (const s of [
      scope("a2Only", f.orgA, f.a2),
      scope("orgB", f.orgB, f.b1),
    ]) {
      await expect(
        getReservation(runtime, s, created.id),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        cancelReservation(runtime, s, created.id),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await listReservations(runtime, s, date)).toEqual([]);
    }
  });
  it("creation needs both read and create rights and current VenueAccess", async () => {
    await expect(
      createReservation(runtime, scope("a1Only"), command()),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await adminPool.query(
      "UPDATE projectx_test.venue_permission_grants SET revoked_at=now(),version=version+1 WHERE venue_access_id=$1 AND permission_id='reservation.create'",
      [f.orgAdminAccess],
    );
    await expect(
      createReservation(runtime, scope(), command()),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect((await searchAvailability(runtime, scope(), query())).length).toBe(
      4,
    );
  });
  it("revoked venue access is denied on subsequent commands", async () => {
    const created = await createReservation(runtime, scope(), command());
    await adminPool.query(
      "UPDATE projectx_test.venue_access SET revoked_at=now() WHERE id=$1",
      [f.orgAdminAccess],
    );
    await expect(
      getReservation(runtime, scope(), created.id),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await expect(
      cancelReservation(runtime, scope(), created.id),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
  it("disabled users and unbranded caller identities are rejected", async () => {
    const untrusted = {
      ...scope(),
      identity: { userId: f.identities.orgA.user },
    } as ReservationScope;
    await expect(
      searchAvailability(runtime, untrusted, query()),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=now() WHERE id=$1",
      [f.identities.orgA.user],
    );
    await expect(
      createReservation(runtime, scope(), command()),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await expect(
      searchAvailability(runtime, scope(), query()),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
  it("read-only permission cannot cancel or create", async () => {
    const created = await createReservation(runtime, scope(), command());
    await adminPool.query(
      "UPDATE projectx_test.venue_permission_grants SET revoked_at=now(),version=version+1 WHERE venue_access_id=$1 AND permission_id IN ('reservation.create','reservation.cancel')",
      [f.orgAdminAccess],
    );
    expect(await getReservation(runtime, scope(), created.id)).toEqual(created);
    await expect(
      cancelReservation(runtime, scope(), created.id),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await expect(
      createReservation(runtime, scope(), command()),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
  it("concurrent cancellation releases capacity exactly once and audit failure preserves occupancy", async () => {
    const created = await createReservation(runtime, scope(), command());
    await adminPool.query(
      `CREATE FUNCTION projectx_test.reject_cancel_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='CANCELLED' THEN RAISE EXCEPTION 'synthetic cancellation failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_cancel_audit BEFORE INSERT ON projectx_test.reservation_changes FOR EACH ROW EXECUTE FUNCTION projectx_test.reject_cancel_audit()`,
    );
    await expect(
      cancelReservation(runtime, scope(), created.id),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    expect((await getReservation(runtime, scope(), created.id)).status).toBe(
      "BOOKED",
    );
    expect(
      (await searchAvailability(runtime, scope(), query())).some(
        (s) => s.startsAt === start,
      ),
    ).toBe(false);
    await adminPool.query(
      "DROP TRIGGER reject_cancel_audit ON projectx_test.reservation_changes",
    );
    const results = await Promise.all([
      cancelReservation(runtime, scope(), created.id),
      cancelReservation(runtime, scope(), created.id),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await counts()).toEqual({ bookings: 1, clients: 1, changes: 2 });
    await expect(
      adminPool.query("DELETE FROM projectx_test.reservation_changes"),
    ).rejects.toMatchObject({ code: "23514" });
    await createReservation(runtime, scope(), command());
    expect(await counts()).toEqual({ bookings: 2, clients: 2, changes: 3 });
  });
  it("non-DST offset conversion preserves venue date and command keys are venue-scoped", async () => {
    const firstInput = command();
    await createReservation(runtime, scope(), firstInput);
    const other = await configure(
      f.orgA,
      f.a2,
      date,
      0,
      120,
      60,
      15,
      "Asia/Kolkata",
    );
    const slots = await searchAvailability(
      runtime,
      scope("a2Only", f.orgA, f.a2),
      { date, partySize: 2 },
    );
    const selected = slots[0];
    if (!selected) throw Error("missing offset slot");
    expect(selected.startsAt).toBe(`${year}-01-14T18:30:00.000Z`);
    const result = await createReservation(
      runtime,
      scope("a2Only", f.orgA, f.a2),
      command({
        ...selected,
        tableId: other.table,
        shiftId: other.shift,
        idempotencyKey: firstInput.idempotencyKey,
      }),
    );
    expect(result.date).toBe(date);
    expect((await counts()).bookings).toBe(2);
    await expect(
      createReservation(runtime, scope(), command({ ...selected })),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
  });
  it("raw RLS hides foreign rows and denies missing/forged context; pool settings reset", async () => {
    await createReservation(runtime, scope(), command());
    const client = await runtime.connect();
    try {
      expect(
        (await client.query("SELECT id FROM projectx_test.reservations")).rows,
      ).toEqual([]);
      await raw(client, scope("orgA", f.orgB, f.b1));
      expect(
        (await client.query("SELECT id FROM projectx_test.reservations")).rows,
      ).toEqual([]);
      await expect(
        client.query(
          "INSERT INTO projectx_test.reservation_clients VALUES($1,$2,now())",
          [newPeopleId(), f.orgB],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await client.query("ROLLBACK");
      expect(
        (await client.query("SELECT id FROM projectx_test.reservations")).rows,
      ).toEqual([]);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
  it("runtime is non-owner/NOBYPASSRLS and cannot change config, audit or immutable allocation", async () => {
    const role = (
      await runtime.query(
        "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
    const created = await createReservation(runtime, scope(), command());
    for (const sql of [
      "UPDATE projectx_test.reservation_tables SET capacity=50",
      "DELETE FROM projectx_test.reservations",
      "UPDATE projectx_test.reservations SET starts_at=now()",
      "DELETE FROM projectx_test.reservation_changes",
      "SELECT * FROM projectx_test.reservation_clients",
    ])
      await expect(runtime.query(sql)).rejects.toMatchObject({ code: "42501" });
    await withAuthorizedPeopleTransaction(
      runtime,
      scope().identity,
      {
        organizationId: f.orgA,
        venueId: f.a1,
        permissionId: "reservation.cancel",
      },
      async (c) => {
        await c.query(
          "UPDATE reservations SET status='CANCELLED' WHERE id=$1",
          [created.id],
        );
        await expect(
          c.query("UPDATE reservations SET status='BOOKED' WHERE id=$1", [
            created.id,
          ]),
        ).rejects.toMatchObject({ code: "23514" });
      },
    );
  });
  it("audit failure rolls back reservation, client and command key; clean retry succeeds", async () => {
    const input = command();
    await adminPool.query(
      `CREATE FUNCTION projectx_test.reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$; CREATE TRIGGER reject_test_audit BEFORE INSERT ON projectx_test.reservation_changes FOR EACH ROW EXECUTE FUNCTION projectx_test.reject_test_audit()`,
    );
    await expect(
      createReservation(runtime, scope(), input),
    ).rejects.toMatchObject({ code: "INTERNAL", message: "INTERNAL" });
    expect(await counts()).toEqual({ bookings: 0, clients: 0, changes: 0 });
    await adminPool.query(
      "DROP TRIGGER reject_test_audit ON projectx_test.reservation_changes",
    );
    await createReservation(runtime, scope(), input);
    expect((await counts()).bookings).toBe(1);
  });
  it("raw validation rejects capacity/end-time bypass before persistence", async () => {
    const client = await runtime.connect();
    try {
      await raw(client);
      await expect(
        rawInsert(client, start, `${date}T18:15:00Z`),
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    expect(await counts()).toEqual({ bookings: 0, clients: 0, changes: 0 });
  });
  it("rejects invalid dates, unsafe contact, invalid UUIDs and invalid time windows", async () => {
    for (const input of [
      { date: `${year}-02-30` },
      { partySize: 0 },
      { partySize: 1.5 },
      { guestName: "secret\nvalue" },
      { guestEmail: "bad" },
      { tableId: "not-id" },
      { startsAt: `${date}T18:00:00` },
    ])
      await expect(
        createReservation(runtime, scope(), command(input)),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      searchAvailability(runtime, scope(), {
        ...query(),
        fromMinute: 800,
        toMinute: 700,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      adminPool.query(
        "UPDATE projectx_test.reservation_venue_settings SET timezone='NOT/A_ZONE'",
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("has no public reservation HTTP route or fixture authentication wiring", async () => {
    const app = createApp(
      loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" }),
    );
    try {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/reservations",
            payload: {},
          })
        ).statusCode,
      ).toBe(404);
    } finally {
      await app.close();
    }
  });
  it("DST spring gap is absent; repeated fall slots are distinct UTC instants", async () => {
    const sunday = (month: number, nth: number) => {
      const first = new Date(Date.UTC(year, month - 1, 1));
      return `${year}-${String(month).padStart(2, "0")}-${String(1 + ((7 - first.getUTCDay()) % 7) + 7 * (nth - 1)).padStart(2, "0")}`;
    };
    const spring = sunday(3, 2),
      fall = sunday(11, 1);
    await configure(f.orgA, f.a1, spring, 0, 240, 30, 30);
    const gap = await searchAvailability(runtime, scope(), {
      date: spring,
      partySize: 2,
    });
    const localHour = (utc: string) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date(utc));
    expect(gap.length).toBeGreaterThan(0);
    expect(gap.some((s) => localHour(s.startsAt) === "02")).toBe(false);
    await configure(f.orgA, f.a1, fall, 0, 240, 30, 30);
    const fold = await searchAvailability(runtime, scope(), {
      date: fall,
      partySize: 2,
    });
    const repeated = fold.filter(
      (s) => localHour(s.startsAt) === "01" && s.tableId === tableId,
    );
    expect(repeated).toHaveLength(4);
    expect(new Set(repeated.map((s) => s.startsAt)).size).toBe(4);
    for (const slot of [repeated[0], repeated[2]]) {
      if (!slot) throw Error("missing fold");
      const r = await createReservation(
        runtime,
        scope(),
        command({ ...slot, date: fall }),
      );
      expect(r.date).toBe(fall);
      expect(
        new Date(r.endsAt).getTime() - new Date(r.startsAt).getTime(),
      ).toBe(30 * 60000);
    }
  });
  it("rejects nonexistent shift boundaries and applies deterministic fold boundary resolution", async () => {
    // US transitions determined from calendar, rather than a fixed historical fixture.
    const nth = (month: number, n: number) => {
      const d =
        1 +
        ((7 - new Date(Date.UTC(year, month - 1, 1)).getUTCDay()) % 7) +
        7 * (n - 1);
      return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    };
    const spring = nth(3, 2),
      fall = nth(11, 1);
    await configure(f.orgA, f.a1, spring, 150, 240, 30, 30);
    expect(
      await searchAvailability(runtime, scope(), {
        date: spring,
        partySize: 2,
      }),
    ).toEqual([]);
    await configure(f.orgA, f.a1, fall, 90, 150, 30, 30);
    const slots = await searchAvailability(runtime, scope(), {
      date: fall,
      partySize: 2,
    });
    expect(slots[0]?.startsAt).toBe(`${fall}T07:30:00.000Z`);
  });
  it("migration is replay-safe and clean/upgrade produce the same reservation schema", async () => {
    await migrateTestDatabase();
    const schemaShape = async () => {
      const columns = await adminPool.query(
        `SELECT table_name,column_name,data_type,is_nullable,column_default
         FROM information_schema.columns WHERE table_schema='projectx_test'
         AND (table_name LIKE 'reservation_%' OR table_name='reservations')
         ORDER BY table_name,ordinal_position`,
      );
      const constraints = await adminPool.query(
        `SELECT c.conname,pg_get_constraintdef(c.oid) AS definition
         FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
         JOIN pg_namespace n ON n.oid=t.relnamespace
         WHERE n.nspname='projectx_test'
         AND (t.relname LIKE 'reservation_%' OR t.relname='reservations')
         ORDER BY c.conname`,
      );
      const policies = await adminPool.query(
        `SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
         WHERE schemaname='projectx_test'
         AND (tablename LIKE 'reservation_%' OR tablename='reservations')
         ORDER BY tablename,policyname`,
      );
      return {
        columns: columns.rows,
        constraints: constraints.rows,
        policies: policies.rows,
      };
    };
    const cleanShape = await schemaShape();
    const migration =
      "zz-reservation-domain/20261017001000_reservation_domain.sql";
    const sql = await readFile(
      new URL(`../../migrations/${migration}`, import.meta.url),
      "utf8",
    );
    await adminPool.query(
      "DROP TABLE projectx_test.reservation_modifications,projectx_test.reservation_changes,projectx_test.reservations,projectx_test.reservation_clients,projectx_test.reservation_tables,projectx_test.reservation_shifts,projectx_test.reservation_venue_settings CASCADE",
    );
    await adminPool.query(
      "DROP FUNCTION projectx_test.reservation_slots(date,integer),projectx_test.reservation_allowed(text),projectx_test.reservation_zone_validate(),projectx_test.reservation_validate(),projectx_test.reservation_record_change(),projectx_test.reservation_change_immutable()",
    );
    await adminPool.query(
      "DELETE FROM projectx_test.schema_migrations WHERE name=ANY($1)",
      [
        [
          migration,
          "zz-reservation-domain/20261024001100_reservation_modification.sql",
          "zz-reservation-domain/20261026001200_reservation_lifecycle.sql",
        ],
      ],
    );
    await migrateTestDatabase();
    await migrateTestDatabase();
    expect(await schemaShape()).toEqual(cleanShape);
    expect(sql).toContain("reservation_no_overlap");
    const tables = await adminPool.query(
      "SELECT relname,relrowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='projectx_test' AND relkind='r' AND (relname LIKE 'reservation_%' OR relname='reservations')",
    );
    expect(tables.rows).toHaveLength(7);
    expect(tables.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});

const modification = (
  booking: Reservation,
  overrides: Partial<ModifyReservation> = {},
): ModifyReservation => ({
  reservationId: booking.id,
  expectedRevision: booking.revision,
  idempotencyKey: crypto.randomUUID(),
  date: booking.date,
  startsAt: `${date}T19:00:00.000Z`,
  tableId: booking.tableId,
  shiftId: booking.shiftId,
  partySize: booking.partySize,
  ...overrides,
});
async function modificationRows() {
  return (
    await adminPool.query(
      "SELECT * FROM projectx_test.reservation_modifications ORDER BY expected_revision",
    )
  ).rows;
}
async function anotherTable(capacity = 4) {
  const table = newPeopleId();
  await adminPool.query(
    "INSERT INTO projectx_test.reservation_tables VALUES($1,$2,$3,'Synthetic extra', $4,true)",
    [table, f.orgA, f.a1, capacity],
  );
  return table;
}
async function revokePermission(permission: string) {
  await adminPool.query(
    "UPDATE projectx_test.venue_permission_grants SET revoked_at=now(),version=version+1 WHERE venue_access_id=$1 AND permission_id=$2",
    [f.orgAdminAccess, permission],
  );
}
const modifySql =
  "SELECT * FROM projectx_test.reservation_modify($1,$2,$3,$4,$5,$6,$7,$8)";
const modifyArgs = (input: ModifyReservation) => [
  input.reservationId,
  input.expectedRevision,
  input.idempotencyKey,
  input.date,
  input.startsAt,
  input.tableId,
  input.shiftId,
  input.partySize,
];
async function waitForBlockedConnection(blocker: number) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = await adminPool.query(
      "SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))",
      [blocker],
    );
    if (result.rowCount) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw Error("Expected a real blocked database connection");
}

describe("RESERVATION-DOMAIN-002 atomic modification PostgreSQL16", () => {
  beforeEach(async () => {
    for (const [actor, org, venue, access] of [
      [f.identities.orgA.user, f.orgA, f.a1, f.orgAdminAccess],
      [f.identities.a2Only.user, f.orgA, f.a2, f.identities.a2Only.access[0]],
      [f.identities.orgB.user, f.orgB, f.b1, f.identities.orgB.access[0]],
    ])
      await adminPool.query(
        "INSERT INTO projectx_test.venue_permission_grants(id,organization_id,venue_id,venue_access_id,permission_id,granted_by_user_id) VALUES($1,$2,$3,$4,'reservation.update',$5)",
        [newPeopleId(), org, venue, access, actor],
      );
  });
  it("upgrade from persisted DOMAIN-001 retains bookings, clients, audit, checksums and least privileges", async () => {
    const schema = async () => {
      const tables = await adminPool.query(
        "SELECT relname,relrowsecurity,relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='projectx_test' AND relkind='r' AND (relname='reservations' OR relname LIKE 'reservation_%') ORDER BY relname",
      );
      const functions = await adminPool.query(
        "SELECT proname,prosecdef,proconfig,proacl::text,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='projectx_test' AND proname LIKE 'reservation_%' ORDER BY proname",
      );
      return { tables: tables.rows, functions: functions.rows };
    };
    const clean = await schema();
    // Rebuild only the domain from its unmodified original migration, retaining the People fixture.
    await adminPool.query(
      "DROP TABLE projectx_test.reservation_modifications,projectx_test.reservation_changes,projectx_test.reservations,projectx_test.reservation_clients,projectx_test.reservation_tables,projectx_test.reservation_shifts,projectx_test.reservation_venue_settings CASCADE",
    );
    await adminPool.query(
      "DROP FUNCTION projectx_test.reservation_slots(date,integer),projectx_test.reservation_allowed(text),projectx_test.reservation_zone_validate(),projectx_test.reservation_validate(),projectx_test.reservation_record_change(),projectx_test.reservation_change_immutable()",
    );
    const originalSql = await readFile(
      new URL(
        "../../migrations/zz-reservation-domain/20261017001000_reservation_domain.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const owner = await adminPool.connect();
    try {
      await owner.query("BEGIN");
      await owner.query("SET LOCAL search_path TO projectx_test, public");
      await owner.query(originalSql);
      await owner.query(
        "DELETE FROM schema_migrations WHERE name IN ('zz-reservation-domain/20261024001100_reservation_modification.sql','zz-reservation-domain/20261026001200_reservation_lifecycle.sql')",
      );
      await owner.query("COMMIT");
    } finally {
      await owner.query("ROLLBACK");
      owner.release();
    }
    const configured = await configure();
    tableId = configured.table;
    shiftId = configured.shift;
    const client = await runtime.connect();
    try {
      await raw(client);
      await rawInsert(client);
      await rawInsert(client, `${date}T19:00:00Z`, `${date}T20:00:00Z`);
      await client.query(
        "UPDATE projectx_test.reservations SET status='CANCELLED' WHERE starts_at=$1",
        [`${date}T19:00:00Z`],
      );
      await client.query("COMMIT");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    const before = (
      await adminPool.query(
        "SELECT * FROM projectx_test.reservations ORDER BY id",
      )
    ).rows;
    const audit = (
      await adminPool.query(
        "SELECT * FROM projectx_test.reservation_changes ORDER BY reservation_id,action",
      )
    ).rows;
    const clients = (
      await adminPool.query(
        "SELECT * FROM projectx_test.reservation_clients ORDER BY id",
      )
    ).rows;
    const ledger = (
      await adminPool.query(
        "SELECT name,checksum FROM projectx_test.schema_migrations ORDER BY name",
      )
    ).rows;
    await migrateTestDatabase();
    await migrateTestDatabase();
    const after = (
      await adminPool.query(
        "SELECT * FROM projectx_test.reservations ORDER BY id",
      )
    ).rows;
    expect(
      after.map(({ revision, ...r }) => {
        expect(revision).toBe(1);
        return r;
      }),
    ).toEqual(before);
    expect(
      (
        await adminPool.query(
          "SELECT * FROM projectx_test.reservation_changes ORDER BY reservation_id,action",
        )
      ).rows,
    ).toEqual(audit);
    expect(
      (
        await adminPool.query(
          "SELECT * FROM projectx_test.reservation_clients ORDER BY id",
        )
      ).rows,
    ).toEqual(clients);
    expect(
      (
        await adminPool.query(
          "SELECT name,checksum FROM projectx_test.schema_migrations WHERE name NOT IN ('zz-reservation-domain/20261024001100_reservation_modification.sql','zz-reservation-domain/20261026001200_reservation_lifecycle.sql') ORDER BY name",
        )
      ).rows,
    ).toEqual(ledger);
    expect(await schema()).toEqual(clean);
    const booked = after.find((r) => r.status === "BOOKED");
    if (!booked) throw Error("Missing historical booking");
    const record = await getReservation(runtime, scope(), booked.id);
    expect(
      (await modifyReservation(runtime, scope(), modification(record)))
        .revision,
    ).toBe(2);
  });
  it("both real row-lock orders of modification versus cancellation preserve terminal cancellation", async () => {
    for (const first of ["modify", "cancel"]) {
      const created = await createReservation(runtime, scope(), command());
      const client = await runtime.connect();
      let pending: Promise<PromiseSettledResult<Reservation>[]> | undefined;
      try {
        await raw(client);
        const blocker = (await client.query("SELECT pg_backend_pid() pid"))
          .rows[0].pid;
        if (first === "modify")
          await client.query(modifySql, modifyArgs(modification(created)));
        else
          await client.query(
            "UPDATE projectx_test.reservations SET status='CANCELLED' WHERE id=$1",
            [created.id],
          );
        pending = Promise.allSettled([
          first === "modify"
            ? cancelReservation(runtime, scope(), created.id)
            : modifyReservation(runtime, scope(), modification(created)),
        ]);
        await waitForBlockedConnection(blocker);
        await client.query("COMMIT");
        const [result] = await pending;
        if (first === "modify") expect(result?.status).toBe("fulfilled");
        else
          expect(result).toMatchObject({
            status: "rejected",
            reason: { code: "INVALID_STATE" },
          });
        expect(
          await getReservation(runtime, scope(), created.id),
        ).toMatchObject({
          status: "CANCELLED",
          revision: first === "modify" ? 3 : 2,
        });
      } finally {
        await client.query("ROLLBACK");
        client.release();
        await pending;
      }
    }
  });
  it("revocation while replay waits for a row lock is rechecked after the wait", async () => {
    const created = await createReservation(runtime, scope(), command());
    const input = modification(created);
    const updated = await modifyReservation(runtime, scope(), input);
    const client = await runtime.connect();
    let pending: Promise<PromiseSettledResult<Reservation>[]> | undefined;
    try {
      await raw(client);
      const blocker = (await client.query("SELECT pg_backend_pid() pid"))
        .rows[0].pid;
      await client.query(
        "SELECT id FROM projectx_test.reservations WHERE id=$1 FOR UPDATE",
        [created.id],
      );
      pending = Promise.allSettled([
        modifyReservation(runtime, scope(), input),
      ]);
      await waitForBlockedConnection(blocker);
      await revokePermission("reservation.update");
      await client.query("COMMIT");
      expect((await pending)[0]).toMatchObject({
        status: "rejected",
        reason: { code: "ACCESS_DENIED" },
      });
      expect(await getReservation(runtime, scope(), created.id)).toEqual(
        updated,
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pending;
    }
  });
  it("DEMONSTRATION: create → modify → old free/new occupied → staff read → failed change preserved → cancel → restored", async () => {
    const before = await searchAvailability(runtime, scope(), {
      date,
      partySize: 2,
    });
    const created = await createReservation(runtime, scope(), command());
    const updated = await modifyReservation(
      runtime,
      scope(),
      modification(created),
    );
    expect(updated).toMatchObject({
      id: created.id,
      clientId: created.clientId,
      guestName: created.guestName,
      guestEmail: created.guestEmail,
      organizationId: f.orgA,
      venueId: f.a1,
      revision: 2,
      startsAt: `${date}T19:00:00.000Z`,
    });
    const slots = await searchAvailability(runtime, scope(), {
      date,
      partySize: 2,
    });
    expect(slots.some((s) => s.startsAt === start)).toBe(true);
    expect(slots.some((s) => s.startsAt === updated.startsAt)).toBe(false);
    expect(await getReservation(runtime, scope(), created.id)).toEqual(updated);
    expect(await listReservations(runtime, scope(), date)).toEqual([updated]);
    await expect(
      modifyReservation(
        runtime,
        scope(),
        modification(updated, { startsAt: `${date}T22:00:00Z` }),
      ),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(updated);
    const cancelled = await cancelReservation(runtime, scope(), created.id);
    expect(cancelled).toMatchObject({ status: "CANCELLED", revision: 3 });
    expect(await cancelReservation(runtime, scope(), created.id)).toEqual(
      cancelled,
    );
    expect(
      await searchAvailability(runtime, scope(), { date, partySize: 2 }),
    ).toEqual(before);
    console.log(
      "Synthetic modification demo PASS: create/modify/old-free/new-occupied/staff-read/failed-change-preserved/cancel/restored.",
    );
  });
  it("changes tables and preserves guest identity/contact and creation metadata", async () => {
    const created = await createReservation(runtime, scope(), command());
    const table = await anotherTable();
    const updated = await modifyReservation(
      runtime,
      scope(),
      modification(created, { tableId: table, startsAt: start }),
    );
    expect(updated).toMatchObject({
      ...created,
      tableId: table,
      revision: 2,
      updatedAt: updated.updatedAt,
    });
    expect(
      (await searchAvailability(runtime, scope(), query())).some(
        (s) => s.tableId === tableId && s.startsAt === start,
      ),
    ).toBe(true);
  });
  it("changes party size within capacity without treating its own allocation as a conflict", async () => {
    const created = await createReservation(runtime, scope(), command());
    const updated = await modifyReservation(
      runtime,
      scope(),
      modification(created, { startsAt: start, partySize: 1 }),
    );
    expect(updated).toMatchObject({
      partySize: 1,
      revision: 2,
      startsAt: start,
    });
    await expect(
      modifyReservation(
        runtime,
        scope(),
        modification(updated, { partySize: 3 }),
      ),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(updated);
  });
  it("changes date and shift, derives end time, and updates staff date lists", async () => {
    const created = await createReservation(runtime, scope(), command());
    const nextDate = `${year}-01-16`;
    const other = await configure(f.orgA, f.a1, nextDate, 720, 840, 30);
    const input = {
      ...modification(created, {
        date: nextDate,
        shiftId: other.shift,
        startsAt: `${nextDate}T18:00:00Z`,
      }),
      endsAt: `${nextDate}T23:00:00Z`,
    };
    const updated = await modifyReservation(runtime, scope(), input);
    expect(updated).toMatchObject({
      date: nextDate,
      endsAt: `${nextDate}T18:30:00.000Z`,
      revision: 2,
    });
    expect(await listReservations(runtime, scope(), date)).toEqual([]);
    expect(await listReservations(runtime, scope(), nextDate)).toEqual([
      updated,
    ]);
  });
  it("invalid/unconfigured slots and inactive tables preserve reservation and command ledger", async () => {
    const created = await createReservation(runtime, scope(), command());
    for (const input of [
      modification(created, { startsAt: `${date}T19:01:00Z` }),
      modification(created, { shiftId: newPeopleId() }),
      modification(created, { partySize: 3 }),
    ])
      await expect(
        modifyReservation(runtime, scope(), input),
      ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
    const inactive = await anotherTable();
    await adminPool.query(
      "UPDATE projectx_test.reservation_tables SET active=false WHERE id=$1",
      [inactive],
    );
    await expect(
      modifyReservation(
        runtime,
        scope(),
        modification(created, { tableId: inactive }),
      ),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(created);
    expect(await modificationRows()).toHaveLength(0);
  });
  it("occupied target fails atomically, retains old capacity and leaves the key reusable", async () => {
    const created = await createReservation(runtime, scope(), command());
    const occupied = await createReservation(
      runtime,
      scope(),
      command({ startsAt: `${date}T19:00:00Z` }),
    );
    const input = modification(created);
    await expect(
      modifyReservation(runtime, scope(), input),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(created);
    expect(await modificationRows()).toHaveLength(0);
    expect(
      (await searchAvailability(runtime, scope(), query())).some(
        (s) => s.startsAt === start,
      ),
    ).toBe(false);
    await cancelReservation(runtime, scope(), occupied.id);
    expect((await modifyReservation(runtime, scope(), input)).revision).toBe(2);
  });
  it("rejects stale revision and invalid revisions without writing", async () => {
    const created = await createReservation(runtime, scope(), command());
    const updated = await modifyReservation(
      runtime,
      scope(),
      modification(created),
    );
    await expect(
      modifyReservation(runtime, scope(), modification(created)),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    for (const expectedRevision of [0, -1, 1.5, NaN, 2147483647])
      await expect(
        modifyReservation(
          runtime,
          scope(),
          modification(updated, { expectedRevision }),
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(updated);
    expect(await modificationRows()).toHaveLength(1);
  });
  it("two concurrent modifications of one revision have exactly one winner", async () => {
    const created = await createReservation(runtime, scope(), command());
    const results = await Promise.allSettled([
      modifyReservation(runtime, scope(), modification(created)),
      modifyReservation(
        runtime,
        scope(),
        modification(created, { startsAt: start, partySize: 1 }),
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "VERSION_CONFLICT" },
    });
    expect((await getReservation(runtime, scope(), created.id)).revision).toBe(
      2,
    );
    expect(await modificationRows()).toHaveLength(1);
  });
  it("two reservations competing for one table cannot both move; loser remains unchanged", async () => {
    const secondTable = await anotherTable(),
      target = await anotherTable();
    const a = await createReservation(runtime, scope(), command());
    const b = await createReservation(
      runtime,
      scope(),
      command({ tableId: secondTable }),
    );
    const results = await Promise.allSettled(
      [a, b].map((r) =>
        modifyReservation(
          runtime,
          scope(),
          modification(r, { tableId: target, startsAt: start }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "CAPACITY_CONFLICT" },
    });
    for (const [i, r] of [a, b].entries())
      if (results[i]?.status === "rejected")
        expect(await getReservation(runtime, scope(), r.id)).toEqual(r);
    expect(await modificationRows()).toHaveLength(1);
  });
  it("same-key concurrency replays one exact result and rejects changed payload", async () => {
    const createInput = command();
    const created = await createReservation(runtime, scope(), createInput);
    const input = modification(created, {
      idempotencyKey: createInput.idempotencyKey,
    });
    const [a, b] = await Promise.all([
      modifyReservation(runtime, scope(), input),
      modifyReservation(runtime, scope(), input),
    ]);
    expect(a).toEqual(b);
    expect(await modifyReservation(runtime, scope(), input)).toEqual(a);
    for (const changed of [
      { partySize: 1 },
      { expectedRevision: 2 },
      { reservationId: newPeopleId() },
    ]) {
      const expected =
        "reservationId" in changed ? "NOT_FOUND" : "IDEMPOTENCY_CONFLICT";
      await expect(
        modifyReservation(runtime, scope(), { ...input, ...changed }),
      ).rejects.toMatchObject({ code: expected });
    }
    expect(await modificationRows()).toHaveLength(1);
  });
  it("retry returns historical result after a later change and cancellation, never current state disguised as replay", async () => {
    const created = await createReservation(runtime, scope(), command());
    const input = modification(created);
    const first = await modifyReservation(runtime, scope(), input);
    const second = await modifyReservation(
      runtime,
      scope(),
      modification(first, { startsAt: start, partySize: 1 }),
    );
    expect(second.revision).toBe(3);
    expect(await modifyReservation(runtime, scope(), input)).toEqual(first);
    await cancelReservation(runtime, scope(), created.id);
    expect(await modifyReservation(runtime, scope(), input)).toEqual(first);
    expect(await getReservation(runtime, scope(), created.id)).toMatchObject({
      status: "CANCELLED",
      revision: 4,
    });
    await expect(
      modifyReservation(runtime, scope(), modification(second)),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await modificationRows()).toHaveLength(2);
  });
  it("modification racing cancellation never resurrects a cancelled booking", async () => {
    for (let i = 0; i < 3; i++) {
      const created = await createReservation(runtime, scope(), command());
      const [change, cancel] = await Promise.allSettled([
        modifyReservation(runtime, scope(), modification(created)),
        cancelReservation(runtime, scope(), created.id),
      ]);
      expect(cancel.status).toBe("fulfilled");
      if (change.status === "rejected")
        expect(change.reason).toMatchObject({ code: "INVALID_STATE" });
      const final = await getReservation(runtime, scope(), created.id);
      expect(final).toMatchObject({
        status: "CANCELLED",
        revision: change.status === "fulfilled" ? 3 : 2,
      });
      expect(
        (
          await searchAvailability(runtime, scope(), { date, partySize: 2 })
        ).some((s) => s.startsAt === start),
      ).toBe(true);
    }
  });
  it("known IDs cannot cross organization/Venue boundaries and revoked access blocks replay", async () => {
    const created = await createReservation(runtime, scope(), command());
    const input = modification(created);
    await modifyReservation(runtime, scope(), input);
    for (const s of [
      scope("a2Only", f.orgA, f.a2),
      scope("orgB", f.orgB, f.b1),
    ])
      await expect(modifyReservation(runtime, s, input)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    await expect(
      modifyReservation(runtime, scope("orgA", f.orgB, f.b1), input),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await adminPool.query(
      "UPDATE projectx_test.venue_access SET revoked_at=now() WHERE id=$1",
      [f.orgAdminAccess],
    );
    await expect(
      modifyReservation(runtime, scope(), input),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
  it("read-only and cancellation-only staff cannot modify", async () => {
    const created = await createReservation(runtime, scope(), command());
    await revokePermission("reservation.update");
    await expect(
      modifyReservation(runtime, scope(), modification(created)),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await revokePermission("reservation.cancel");
    await expect(
      modifyReservation(runtime, scope(), modification(created)),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(created);
  });
  it("update permission requires read and never grants cancellation", async () => {
    const created = await createReservation(runtime, scope(), command());
    await revokePermission("reservation.cancel");
    const updated = await modifyReservation(
      runtime,
      scope(),
      modification(created),
    );
    await expect(
      cancelReservation(runtime, scope(), created.id),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    const client = await runtime.connect();
    try {
      await raw(client);
      expect(
        (
          await client.query(
            "UPDATE projectx_test.reservations SET status='CANCELLED' WHERE id=$1",
            [created.id],
          )
        ).rowCount,
      ).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    await revokePermission("reservation.read");
    await expect(
      modifyReservation(runtime, scope(), modification(updated)),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
  it("unbranded identity and disabled user cannot modify or replay", async () => {
    const created = await createReservation(runtime, scope(), command());
    const input = modification(created);
    await modifyReservation(runtime, scope(), input);
    await expect(
      modifyReservation(
        runtime,
        {
          ...scope(),
          identity: { userId: f.identities.orgA.user },
        } as ReservationScope,
        input,
      ),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await adminPool.query(
      "UPDATE projectx_test.users SET disabled_at=now() WHERE id=$1",
      [f.identities.orgA.user],
    );
    await expect(
      modifyReservation(runtime, scope(), input),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
  it("raw SQL cannot alter allocation/revision, spoof audit evidence or bypass trigger through status", async () => {
    const created = await createReservation(runtime, scope(), command());
    for (const sql of [
      "UPDATE projectx_test.reservations SET party_size=1",
      "UPDATE projectx_test.reservations SET revision=2",
      "SELECT * FROM projectx_test.reservation_modifications",
      "DELETE FROM projectx_test.reservation_modifications",
      "TRUNCATE projectx_test.reservation_modifications",
      "INSERT INTO projectx_test.reservation_modifications DEFAULT VALUES",
      "UPDATE projectx_test.reservation_modifications SET request='{}'",
      "ALTER TABLE projectx_test.reservations DISABLE TRIGGER ALL",
    ]) {
      await expect(runtime.query(sql)).rejects.toMatchObject({ code: "42501" });
    }
    const client = await runtime.connect();
    try {
      await raw(client);
      await expect(
        client.query(
          "UPDATE projectx_test.reservations SET status='BOOKED' WHERE id=$1",
          [created.id],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    // Even an owner-issued scoped update without protected command evidence fails the validation trigger.
    const owner = await adminPool.connect();
    try {
      await raw(owner);
      await expect(
        owner.query(
          "UPDATE projectx_test.reservations SET revision=revision+1,party_size=1 WHERE id=$1",
          [created.id],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await owner.query("ROLLBACK");
      owner.release();
    }
    expect(await getReservation(runtime, scope(), created.id)).toEqual(created);
  });
  it("direct modification function enforces scope/rights/version and current capacity without trusting service", async () => {
    const created = await createReservation(runtime, scope(), command());
    const input = modification(created);
    await expect(
      runtime.query(modifySql, modifyArgs(input)),
    ).rejects.toMatchObject({ code: "42501" });
    const client = await runtime.connect();
    for (const [s, args, code] of [
      [scope("orgA", f.orgB, f.b1), input, "42501"],
      [scope("orgB", f.orgB, f.b1), input, "P1001"],
      [scope(), { ...input, expectedRevision: 2 }, "P1004"],
      [scope(), { ...input, partySize: 3 }, "P1005"],
    ] as const) {
      try {
        await raw(client, s);
        await expect(
          client.query(modifySql, modifyArgs(args)),
        ).rejects.toMatchObject({ code });
      } finally {
        await client.query("ROLLBACK");
      }
    }
    client.release();
    expect(await getReservation(runtime, scope(), created.id)).toEqual(created);
  });
  it("audit failure rolls back allocation/revision/key; successful retry records immutable narrow before/after evidence", async () => {
    const created = await createReservation(runtime, scope(), command());
    const input = modification(created);
    await adminPool.query(
      "CREATE FUNCTION projectx_test.reject_mod_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$; CREATE TRIGGER reject_mod_audit BEFORE INSERT ON projectx_test.reservation_modifications FOR EACH ROW EXECUTE FUNCTION projectx_test.reject_mod_audit()",
    );
    await expect(
      modifyReservation(runtime, scope(), input),
    ).rejects.toMatchObject({ code: "INTERNAL", message: "INTERNAL" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(created);
    expect(await modificationRows()).toHaveLength(0);
    await adminPool.query(
      "DROP TRIGGER reject_mod_audit ON projectx_test.reservation_modifications",
    );
    const updated = await modifyReservation(runtime, scope(), input);
    const [audit] = await modificationRows();
    expect(audit).toMatchObject({
      actor_user_id: f.identities.orgA.user,
      reservation_id: created.id,
      expected_revision: 1,
      before_allocation: { revision: 1, table_id: created.tableId },
      after_allocation: { revision: 2, table_id: updated.tableId },
    });
    expect(JSON.stringify(audit)).not.toContain(created.guestName);
    expect(JSON.stringify(audit)).not.toContain(created.guestEmail);
    for (const sql of [
      "DELETE FROM projectx_test.reservation_modifications",
      "UPDATE projectx_test.reservation_modifications SET request='{}'",
    ])
      await expect(adminPool.query(sql)).rejects.toMatchObject({
        code: "23514",
      });
  });
  it("modifies across venue-local midnight in Kolkata without losing the local date", async () => {
    await adminPool.query(
      "UPDATE projectx_test.reservation_venue_settings SET timezone='Asia/Kolkata'",
    );
    const created = await createReservation(
      runtime,
      scope(),
      command({ startsAt: `${date}T06:30:00Z` }),
    );
    const next = `${year}-01-16`;
    const config = await configure(
      f.orgA,
      f.a1,
      next,
      0,
      120,
      60,
      15,
      "Asia/Kolkata",
    );
    const updated = await modifyReservation(
      runtime,
      scope(),
      modification(created, {
        date: next,
        shiftId: config.shift,
        startsAt: `${date}T18:30:00Z`,
      }),
    );
    expect(updated).toMatchObject({
      date: next,
      timezone: "Asia/Kolkata",
      startsAt: `${date}T18:30:00.000Z`,
      endsAt: `${date}T19:30:00.000Z`,
    });
  });
  it("modifies into DST fold distinct instants and rejects a spring-gap boundary without losing original", async () => {
    const nth = (month: number, n: number) =>
      `${year}-${String(month).padStart(2, "0")}-${String(1 + ((7 - new Date(Date.UTC(year, month - 1, 1)).getUTCDay()) % 7) + 7 * (n - 1)).padStart(2, "0")}`;
    const fall = nth(11, 1),
      spring = nth(3, 2);
    const created = await createReservation(runtime, scope(), command());
    const config = await configure(f.orgA, f.a1, fall, 0, 240, 30, 30);
    const first = await modifyReservation(
      runtime,
      scope(),
      modification(created, {
        date: fall,
        shiftId: config.shift,
        startsAt: `${fall}T06:00:00Z`,
      }),
    );
    const second = await modifyReservation(
      runtime,
      scope(),
      modification(first, {
        date: fall,
        shiftId: config.shift,
        startsAt: `${fall}T07:00:00Z`,
      }),
    );
    expect(first.startsAt).not.toBe(second.startsAt);
    expect(second.endsAt).toBe(`${fall}T07:30:00.000Z`);
    const gap = await configure(f.orgA, f.a1, spring, 150, 240, 30, 30);
    await expect(
      modifyReservation(
        runtime,
        scope(),
        modification(second, {
          date: spring,
          shiftId: gap.shift,
          startsAt: `${spring}T08:30:00Z`,
        }),
      ),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(second);
  });
});

const transition = (
  booking: Reservation,
  overrides: Partial<LifecycleTransition> = {},
): LifecycleTransition => ({
  reservationId: booking.id,
  expectedRevision: booking.revision,
  idempotencyKey: crypto.randomUUID(),
  ...overrides,
});
const transitionSql =
  "SELECT * FROM projectx_test.reservation_transition($1,$2,$3,$4)";
const transitionArgs = (input: LifecycleTransition, status: string) => [
  input.reservationId,
  input.expectedRevision,
  input.idempotencyKey,
  status,
];

describe("RESERVATION-DOMAIN-003 check-in and seating PostgreSQL16", () => {
  beforeEach(async () => {
    for (const [actor, org, venue, access] of [
      [f.identities.orgA.user, f.orgA, f.a1, f.orgAdminAccess],
      [f.identities.a2Only.user, f.orgA, f.a2, f.identities.a2Only.access[0]],
      [f.identities.orgB.user, f.orgB, f.b1, f.identities.orgB.access[0]],
    ])
      for (const permission of [
        "reservation.update",
        "reservation.checkin",
        "reservation.seat",
      ])
        await adminPool.query(
          "INSERT INTO projectx_test.venue_permission_grants(id,organization_id,venue_id,venue_access_id,permission_id,granted_by_user_id) VALUES($1,$2,$3,$4,$5,$6)",
          [newPeopleId(), org, venue, access, permission, actor],
        );
  });

  it("DEMONSTRATION: create → check in → seat → staff retrieve/list → capacity stays protected and invalid/conflicting transitions leave persisted state unchanged", async () => {
    const before = await searchAvailability(runtime, scope(), query());
    expect(before.some((s) => s.startsAt === start)).toBe(true);
    const created = await createReservation(runtime, scope(), command());
    expect(created).toMatchObject({ status: "BOOKED", revision: 1 });

    const checkedIn = await checkInReservation(
      runtime,
      scope(),
      transition(created),
    );
    expect(checkedIn).toMatchObject({
      ...created,
      status: "CHECKED_IN",
      revision: 2,
      updatedAt: expect.any(String),
    });
    expect(
      (await searchAvailability(runtime, scope(), query())).some(
        (s) => s.startsAt === start,
      ),
    ).toBe(false);
    await expect(
      createReservation(runtime, scope(), command()),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });

    const seated = await seatReservation(
      runtime,
      scope(),
      transition(checkedIn),
    );
    expect(seated).toMatchObject({
      ...created,
      status: "SEATED",
      revision: 3,
      updatedAt: expect.any(String),
    });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(seated);
    expect(await listReservations(runtime, scope(), date)).toEqual([seated]);
    expect(
      (await searchAvailability(runtime, scope(), query())).some(
        (s) => s.startsAt === start,
      ),
    ).toBe(false);
    await expect(
      createReservation(runtime, scope(), command()),
    ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });

    const modsBefore = await modificationRows();
    await expect(
      checkInReservation(runtime, scope(), transition(seated)),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(
      seatReservation(runtime, scope(), transition(seated)),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(
      modifyReservation(runtime, scope(), modification(seated)),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(
      cancelReservation(runtime, scope(), seated.id),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(seated);
    expect(await modificationRows()).toEqual(modsBefore);
    console.log(
      "Synthetic domain lifecycle demo PASS: create/check-in/seat/staff-read/capacity-protected/invalid-rejected; no HTTP or UI.",
    );
  });

  it("upgrade from persisted DOMAIN-002 retains bookings, modifications, audit, checksums and least privileges", async () => {
    const schema = async () => {
      const tables = await adminPool.query(
        "SELECT relname,relrowsecurity,relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='projectx_test' AND relkind='r' AND (relname='reservations' OR relname LIKE 'reservation_%') ORDER BY relname",
      );
      const functions = await adminPool.query(
        "SELECT proname,prosecdef,proconfig,proacl::text,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='projectx_test' AND proname LIKE 'reservation_%' ORDER BY proname",
      );
      return { tables: tables.rows, functions: functions.rows };
    };
    const clean = await schema();
    await adminPool.query(
      "DROP TABLE projectx_test.reservation_modifications,projectx_test.reservation_changes,projectx_test.reservations,projectx_test.reservation_clients,projectx_test.reservation_tables,projectx_test.reservation_shifts,projectx_test.reservation_venue_settings CASCADE",
    );
    await adminPool.query(
      "DROP FUNCTION projectx_test.reservation_slots(date,integer),projectx_test.reservation_allowed(text),projectx_test.reservation_zone_validate(),projectx_test.reservation_validate(),projectx_test.reservation_record_change(),projectx_test.reservation_change_immutable()",
    );
    const domain001Sql = await readFile(
      new URL(
        "../../migrations/zz-reservation-domain/20261017001000_reservation_domain.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const domain002Sql = await readFile(
      new URL(
        "../../migrations/zz-reservation-domain/20261024001100_reservation_modification.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const owner = await adminPool.connect();
    try {
      await owner.query("BEGIN");
      await owner.query("SET LOCAL search_path TO projectx_test, public");
      await owner.query(domain001Sql);
      await owner.query(domain002Sql);
      await owner.query(
        "DELETE FROM schema_migrations WHERE name='zz-reservation-domain/20261026001200_reservation_lifecycle.sql'",
      );
      await owner.query("COMMIT");
    } finally {
      await owner.query("ROLLBACK");
      owner.release();
    }
    const configured = await configure();
    tableId = configured.table;
    shiftId = configured.shift;
    const booked = await createReservation(runtime, scope(), command());
    const modified = await modifyReservation(
      runtime,
      scope(),
      modification(booked, { startsAt: `${date}T19:00:00.000Z` }),
    );
    const toCancel = await createReservation(
      runtime,
      scope(),
      command({ startsAt: start }),
    );
    await cancelReservation(runtime, scope(), toCancel.id);

    const beforeBookings = (
      await adminPool.query(
        "SELECT * FROM projectx_test.reservations ORDER BY id",
      )
    ).rows;
    const beforeMods = await modificationRows();
    const beforeChanges = (
      await adminPool.query(
        "SELECT * FROM projectx_test.reservation_changes ORDER BY reservation_id,action",
      )
    ).rows;
    const beforeLedger = (
      await adminPool.query(
        "SELECT name,checksum FROM projectx_test.schema_migrations ORDER BY name",
      )
    ).rows;

    await migrateTestDatabase();
    await migrateTestDatabase();

    expect(
      (
        await adminPool.query(
          "SELECT * FROM projectx_test.reservations ORDER BY id",
        )
      ).rows,
    ).toEqual(beforeBookings);
    expect(await modificationRows()).toEqual(beforeMods);
    expect(
      (
        await adminPool.query(
          "SELECT * FROM projectx_test.reservation_changes ORDER BY reservation_id,action",
        )
      ).rows,
    ).toEqual(beforeChanges);
    expect(
      (
        await adminPool.query(
          "SELECT name,checksum FROM projectx_test.schema_migrations WHERE name<>'zz-reservation-domain/20261026001200_reservation_lifecycle.sql' ORDER BY name",
        )
      ).rows,
    ).toEqual(beforeLedger);
    expect(await schema()).toEqual(clean);

    const checkedIn = await checkInReservation(
      runtime,
      scope(),
      transition(modified),
    );
    expect(checkedIn).toMatchObject({ status: "CHECKED_IN", revision: 3 });
    const seated = await seatReservation(
      runtime,
      scope(),
      transition(checkedIn),
    );
    expect(seated).toMatchObject({ status: "SEATED", revision: 4 });
  });

  it("enforces strict state machine: no skipped check-in, no reversal, no reactivation of cancelled, and no modify/cancel after check-in or seating", async () => {
    const created = await createReservation(runtime, scope(), command());
    await expect(
      seatReservation(runtime, scope(), transition(created)),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(created);

    const checkedIn = await checkInReservation(
      runtime,
      scope(),
      transition(created),
    );
    await expect(
      checkInReservation(runtime, scope(), transition(checkedIn)),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(
      modifyReservation(runtime, scope(), modification(checkedIn)),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(
      cancelReservation(runtime, scope(), checkedIn.id),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(
      checkedIn,
    );

    const seated = await seatReservation(
      runtime,
      scope(),
      transition(checkedIn),
    );
    for (const op of [
      () => checkInReservation(runtime, scope(), transition(seated)),
      () => seatReservation(runtime, scope(), transition(seated)),
      () => modifyReservation(runtime, scope(), modification(seated)),
      () => cancelReservation(runtime, scope(), seated.id),
    ])
      await expect(op()).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(seated);

    const other = await createReservation(
      runtime,
      scope(),
      command({ startsAt: `${date}T19:00:00.000Z` }),
    );
    const cancelled = await cancelReservation(runtime, scope(), other.id);
    expect(await cancelReservation(runtime, scope(), other.id)).toEqual(
      cancelled,
    );
    await expect(
      checkInReservation(runtime, scope(), transition(cancelled)),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(
      seatReservation(runtime, scope(), transition(cancelled)),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await getReservation(runtime, scope(), other.id)).toEqual(cancelled);
  });

  it("preserves active capacity across BOOKED, CHECKED_IN and SEATED for search, create, modify and raw GiST exclusion", async () => {
    const active = await createReservation(runtime, scope(), command());
    const other = await createReservation(
      runtime,
      scope(),
      command({ startsAt: `${date}T19:00:00.000Z` }),
    );
    const checkedIn = await checkInReservation(
      runtime,
      scope(),
      transition(active),
    );
    for (const state of [
      checkedIn,
      await seatReservation(runtime, scope(), transition(checkedIn)),
    ]) {
      expect(["CHECKED_IN", "SEATED"]).toContain(state.status);
      expect(
        (await searchAvailability(runtime, scope(), query())).some(
          (s) => s.startsAt === start,
        ),
      ).toBe(false);
      await expect(
        createReservation(
          runtime,
          scope(),
          command({ startsAt: `${date}T18:15:00.000Z` }),
        ),
      ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
      await expect(
        modifyReservation(
          runtime,
          scope(),
          modification(other, { startsAt: start }),
        ),
      ).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
      const client = await runtime.connect();
      try {
        await raw(client);
        await expect(rawInsert(client)).rejects.toMatchObject({
          code: "23P01",
        });
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    }
  });

  it("enforces independent check-in and seat permissions, requires reservation.read, and does not auto-grant to existing roles or update/cancel holders", async () => {
    expect(
      (
        await adminPool.query(
          "SELECT count(*)::int n FROM projectx_test.role_permissions WHERE permission_id IN ('reservation.checkin','reservation.seat')",
        )
      ).rows[0].n,
    ).toBe(0);
    const created = await createReservation(runtime, scope(), command());
    await revokePermission("reservation.checkin");
    await expect(
      checkInReservation(runtime, scope(), transition(created)),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });

    await adminPool.query(
      "INSERT INTO projectx_test.venue_permission_grants(id,organization_id,venue_id,venue_access_id,permission_id,granted_by_user_id) VALUES($1,$2,$3,$4,'reservation.checkin',$5)",
      [newPeopleId(), f.orgA, f.a1, f.orgAdminAccess, f.identities.orgA.user],
    );
    await revokePermission("reservation.update");
    await revokePermission("reservation.cancel");
    await expect(
      modifyReservation(runtime, scope(), modification(created)),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await expect(
      cancelReservation(runtime, scope(), created.id),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });

    const checkedIn = await checkInReservation(
      runtime,
      scope(),
      transition(created),
    );
    await revokePermission("reservation.seat");
    await expect(
      seatReservation(runtime, scope(), transition(checkedIn)),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });

    await adminPool.query(
      "INSERT INTO projectx_test.venue_permission_grants(id,organization_id,venue_id,venue_access_id,permission_id,granted_by_user_id) VALUES($1,$2,$3,$4,'reservation.seat',$5)",
      [newPeopleId(), f.orgA, f.a1, f.orgAdminAccess, f.identities.orgA.user],
    );
    await revokePermission("reservation.read");
    await expect(
      seatReservation(runtime, scope(), transition(checkedIn)),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });

    await adminPool.query(
      "INSERT INTO projectx_test.venue_permission_grants(id,organization_id,venue_id,venue_access_id,permission_id,granted_by_user_id) VALUES($1,$2,$3,$4,'reservation.read',$5)",
      [newPeopleId(), f.orgA, f.a1, f.orgAdminAccess, f.identities.orgA.user],
    );
    expect(
      (await seatReservation(runtime, scope(), transition(checkedIn))).status,
    ).toBe("SEATED");
  });

  it("enforces tenant/venue RLS isolation, disabled/revoked/unbranded identity denial, and blocks raw SQL status/revision bypass", async () => {
    const created = await createReservation(runtime, scope(), command());
    const input = transition(created);
    for (const s of [
      scope("orgA", f.orgB, f.b1),
      scope("orgA", f.orgA, f.a2),
    ]) {
      await expect(checkInReservation(runtime, s, input)).rejects.toMatchObject(
        { code: "ACCESS_DENIED" },
      );
      await expect(seatReservation(runtime, s, input)).rejects.toMatchObject({
        code: "ACCESS_DENIED",
      });
    }
    for (const s of [
      scope("a2Only", f.orgA, f.a2),
      scope("orgB", f.orgB, f.b1),
    ]) {
      await expect(checkInReservation(runtime, s, input)).rejects.toMatchObject(
        { code: "NOT_FOUND" },
      );
      await expect(seatReservation(runtime, s, input)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
    await expect(
      checkInReservation(
        runtime,
        {
          ...scope(),
          identity: { userId: f.identities.orgA.user },
        } as ReservationScope,
        input,
      ),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });

    const client = await runtime.connect();
    try {
      for (const status of ["CHECKED_IN", "SEATED"]) {
        await raw(client);
        await expect(
          client.query(
            "UPDATE projectx_test.reservations SET status=$1 WHERE id=$2",
            [status, created.id],
          ),
        ).rejects.toMatchObject({ code: "23514" });
        await client.query("ROLLBACK");
      }
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }

    const owner = await adminPool.connect();
    try {
      await raw(owner);
      await expect(
        owner.query(
          "UPDATE projectx_test.reservations SET status='CHECKED_IN',revision=revision+1 WHERE id=$1",
          [created.id],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await owner.query("ROLLBACK");
      owner.release();
    }

    await expect(
      runtime.query(transitionSql, transitionArgs(input, "CHECKED_IN")),
    ).rejects.toMatchObject({ code: "42501" });
    const rawClient = await runtime.connect();
    for (const [s, args, status, code] of [
      [scope("orgA", f.orgB, f.b1), input, "CHECKED_IN", "42501"],
      [scope("orgB", f.orgB, f.b1), input, "CHECKED_IN", "P1001"],
      [scope(), input, "BOOKED", "23514"],
      [scope(), input, "SEATED", "P1003"],
      [scope(), { ...input, expectedRevision: 2 }, "CHECKED_IN", "P1004"],
    ] as const) {
      try {
        await raw(rawClient, s);
        await expect(
          rawClient.query(transitionSql, transitionArgs(args, status)),
        ).rejects.toMatchObject({ code });
      } finally {
        await rawClient.query("ROLLBACK");
      }
    }
    rawClient.release();
    expect(await getReservation(runtime, scope(), created.id)).toEqual(created);
  });

  it("replays same-key retries across sequential/concurrent calls and after later transitions, and rejects conflicting key reuse", async () => {
    const created = await createReservation(runtime, scope(), command());
    const other = await createReservation(
      runtime,
      scope(),
      command({ startsAt: `${date}T19:00:00.000Z` }),
    );
    const checkInCmd = transition(created);
    const [first, second] = await Promise.all([
      checkInReservation(runtime, scope(), checkInCmd),
      checkInReservation(runtime, scope(), checkInCmd),
    ]);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ status: "CHECKED_IN", revision: 2 });
    expect(await checkInReservation(runtime, scope(), checkInCmd)).toEqual(
      first,
    );
    expect(await modificationRows()).toHaveLength(1);

    const seatCmd = transition(first);
    const [seatedA, seatedB] = await Promise.all([
      seatReservation(runtime, scope(), seatCmd),
      seatReservation(runtime, scope(), seatCmd),
    ]);
    expect(seatedA).toEqual(seatedB);
    expect(seatedA).toMatchObject({ status: "SEATED", revision: 3 });
    expect(await checkInReservation(runtime, scope(), checkInCmd)).toEqual(
      first,
    );
    expect(await seatReservation(runtime, scope(), seatCmd)).toEqual(seatedA);
    expect(await getReservation(runtime, scope(), created.id)).toEqual(seatedA);
    expect(await modificationRows()).toHaveLength(2);

    await expect(
      seatReservation(runtime, scope(), {
        ...checkInCmd,
        expectedRevision: 2,
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(
      checkInReservation(runtime, scope(), {
        ...checkInCmd,
        expectedRevision: 2,
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(
      checkInReservation(runtime, scope(), {
        ...checkInCmd,
        reservationId: other.id,
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(
      modifyReservation(
        runtime,
        scope(),
        modification(other, { idempotencyKey: checkInCmd.idempotencyKey }),
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("rejects stale revisions and invalid inputs without consuming keys or mutating state", async () => {
    const created = await createReservation(runtime, scope(), command());
    const modified = await modifyReservation(
      runtime,
      scope(),
      modification(created, { startsAt: `${date}T18:30:00.000Z` }),
    );
    const key = crypto.randomUUID();
    await expect(
      checkInReservation(runtime, scope(), {
        reservationId: created.id,
        expectedRevision: 1,
        idempotencyKey: key,
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    const checkedIn = await checkInReservation(runtime, scope(), {
      reservationId: created.id,
      expectedRevision: modified.revision,
      idempotencyKey: key,
    });
    expect(checkedIn).toMatchObject({ status: "CHECKED_IN", revision: 3 });

    const seatKey = crypto.randomUUID();
    await expect(
      seatReservation(runtime, scope(), {
        reservationId: created.id,
        expectedRevision: 2,
        idempotencyKey: seatKey,
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    const seated = await seatReservation(runtime, scope(), {
      reservationId: created.id,
      expectedRevision: 3,
      idempotencyKey: seatKey,
    });
    expect(seated).toMatchObject({ status: "SEATED", revision: 4 });

    for (const bad of [
      { reservationId: "not-a-uuid" },
      { idempotencyKey: "not-a-uuid" },
      { expectedRevision: 0 },
      { expectedRevision: -1 },
      { expectedRevision: 1.5 },
      { expectedRevision: 2147483647 },
    ]) {
      await expect(
        checkInReservation(runtime, scope(), transition(created, bad)),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(
        seatReservation(runtime, scope(), transition(created, bad)),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
  });

  it("serializes competing check-in commands and competing seating commands with exactly one winner", async () => {
    const created = await createReservation(runtime, scope(), command());
    const checkIns = await Promise.allSettled([
      checkInReservation(runtime, scope(), transition(created)),
      checkInReservation(runtime, scope(), transition(created)),
    ]);
    expect(checkIns.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(checkIns.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "INVALID_STATE" },
    });
    const checkedIn = await getReservation(runtime, scope(), created.id);
    expect(checkedIn).toMatchObject({ status: "CHECKED_IN", revision: 2 });

    const seatings = await Promise.allSettled([
      seatReservation(runtime, scope(), transition(checkedIn)),
      seatReservation(runtime, scope(), transition(checkedIn)),
    ]);
    expect(seatings.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(seatings.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "INVALID_STATE" },
    });
    expect(await getReservation(runtime, scope(), created.id)).toMatchObject({
      status: "SEATED",
      revision: 3,
    });
  });

  it("serializes both lock orders of check-in versus cancellation and seating versus modification or cancellation", async () => {
    for (const first of ["checkIn", "cancel"] as const) {
      const created = await createReservation(
        runtime,
        scope(),
        command({
          startsAt: first === "checkIn" ? start : `${date}T19:00:00.000Z`,
        }),
      );
      const client = await runtime.connect();
      let pending: Promise<Reservation> | undefined;
      try {
        await raw(client);
        const blocker = (await client.query("SELECT pg_backend_pid() pid"))
          .rows[0].pid;
        if (first === "checkIn") {
          await client.query(
            transitionSql,
            transitionArgs(transition(created), "CHECKED_IN"),
          );
          pending = cancelReservation(runtime, scope(), created.id);
        } else {
          await client.query(
            "UPDATE projectx_test.reservations SET status='CANCELLED' WHERE id=$1",
            [created.id],
          );
          pending = checkInReservation(runtime, scope(), transition(created));
        }
        await waitForBlockedConnection(blocker);
        await client.query("COMMIT");
        await expect(pending).rejects.toMatchObject({ code: "INVALID_STATE" });
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
      expect((await getReservation(runtime, scope(), created.id)).status).toBe(
        first === "checkIn" ? "CHECKED_IN" : "CANCELLED",
      );
    }

    const otherTable = await anotherTable();
    const booked = await createReservation(
      runtime,
      scope(),
      command({ tableId: otherTable }),
    );
    const checkedIn = await checkInReservation(
      runtime,
      scope(),
      transition(booked),
    );
    const client = await runtime.connect();
    try {
      await raw(client);
      const blocker = (await client.query("SELECT pg_backend_pid() pid"))
        .rows[0].pid;
      await client.query(
        transitionSql,
        transitionArgs(transition(checkedIn), "SEATED"),
      );
      const waitingModify = modifyReservation(
        runtime,
        scope(),
        modification(checkedIn, { tableId: otherTable }),
      );
      const waitingCancel = cancelReservation(runtime, scope(), checkedIn.id);
      await waitForBlockedConnection(blocker);
      await client.query("COMMIT");
      await expect(waitingModify).rejects.toMatchObject({
        code: "INVALID_STATE",
      });
      await expect(waitingCancel).rejects.toMatchObject({
        code: "INVALID_STATE",
      });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    expect(await getReservation(runtime, scope(), checkedIn.id)).toMatchObject({
      status: "SEATED",
      revision: 3,
    });
  });

  it("rechecks permission after advisory-key or row-lock wait so revoked check-in/seat access cannot complete or replay", async () => {
    const created = await createReservation(runtime, scope(), command());
    const input = transition(created);
    const client = await runtime.connect();
    try {
      await raw(client);
      const blocker = (await client.query("SELECT pg_backend_pid() pid"))
        .rows[0].pid;
      await client.query(
        "SELECT id FROM projectx_test.reservations WHERE id=$1 FOR UPDATE",
        [created.id],
      );
      const waiting = checkInReservation(runtime, scope(), input);
      await waitForBlockedConnection(blocker);
      await revokePermission("reservation.checkin");
      await client.query("COMMIT");
      await expect(waiting).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    expect(await getReservation(runtime, scope(), created.id)).toEqual(created);
    expect(await modificationRows()).toHaveLength(0);
  });

  it("rolls back state, revision and command key on audit failure and records PII-free immutable lifecycle audit evidence", async () => {
    const created = await createReservation(runtime, scope(), command());
    const checkInCmd = transition(created);
    await adminPool.query(
      "CREATE FUNCTION projectx_test.reject_lifecycle_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic lifecycle audit failure'; END $$; CREATE TRIGGER reject_lifecycle_audit BEFORE INSERT ON projectx_test.reservation_modifications FOR EACH ROW EXECUTE FUNCTION projectx_test.reject_lifecycle_audit()",
    );
    await expect(
      checkInReservation(runtime, scope(), checkInCmd),
    ).rejects.toMatchObject({ code: "INTERNAL", message: "INTERNAL" });
    expect(await getReservation(runtime, scope(), created.id)).toEqual(created);
    expect(await modificationRows()).toHaveLength(0);
    await adminPool.query(
      "DROP TRIGGER reject_lifecycle_audit ON projectx_test.reservation_modifications; DROP FUNCTION projectx_test.reject_lifecycle_audit()",
    );

    const checkedIn = await checkInReservation(runtime, scope(), checkInCmd);
    const seated = await seatReservation(
      runtime,
      scope(),
      transition(checkedIn),
    );
    const audits = await modificationRows();
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({
      organization_id: f.orgA,
      venue_id: f.a1,
      actor_user_id: f.identities.orgA.user,
      reservation_id: created.id,
      expected_revision: 1,
      request: {
        operation: "CHECKED_IN",
        reservation_id: created.id,
        expected_revision: 1,
      },
      before_allocation: { status: "BOOKED", revision: 1 },
      after_allocation: { status: "CHECKED_IN", revision: 2 },
    });
    expect(audits[1]).toMatchObject({
      organization_id: f.orgA,
      venue_id: f.a1,
      actor_user_id: f.identities.orgA.user,
      reservation_id: created.id,
      expected_revision: 2,
      request: {
        operation: "SEATED",
        reservation_id: created.id,
        expected_revision: 2,
      },
      before_allocation: { status: "CHECKED_IN", revision: 2 },
      after_allocation: { status: "SEATED", revision: 3 },
    });
    expect(JSON.stringify(audits)).not.toContain(created.guestName);
    expect(JSON.stringify(audits)).not.toContain(created.guestEmail);
    expect(seated).toMatchObject({ status: "SEATED", revision: 3 });
    for (const sql of [
      "DELETE FROM projectx_test.reservation_modifications",
      "UPDATE projectx_test.reservation_modifications SET request='{}'",
    ])
      await expect(adminPool.query(sql)).rejects.toMatchObject({
        code: "23514",
      });
  });
});
