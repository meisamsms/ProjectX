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
  createReservation,
  getReservation,
  listReservations,
  type ReservationScope,
  searchAvailability,
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
      "DROP TABLE projectx_test.reservation_changes,projectx_test.reservations,projectx_test.reservation_clients,projectx_test.reservation_tables,projectx_test.reservation_shifts,projectx_test.reservation_venue_settings CASCADE",
    );
    await adminPool.query(
      "DROP FUNCTION projectx_test.reservation_slots(date,integer),projectx_test.reservation_allowed(text),projectx_test.reservation_zone_validate(),projectx_test.reservation_validate(),projectx_test.reservation_record_change(),projectx_test.reservation_change_immutable()",
    );
    await adminPool.query(
      "DELETE FROM projectx_test.schema_migrations WHERE name=$1",
      [migration],
    );
    await migrateTestDatabase();
    await migrateTestDatabase();
    expect(await schemaShape()).toEqual(cleanShape);
    expect(sql).toContain("reservation_no_overlap");
    const tables = await adminPool.query(
      "SELECT relname,relrowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='projectx_test' AND relkind='r' AND (relname LIKE 'reservation_%' OR relname='reservations')",
    );
    expect(tables.rows).toHaveLength(6);
    expect(tables.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
