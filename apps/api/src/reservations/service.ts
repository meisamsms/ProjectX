import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  PeopleAccessDenied,
  type TrustedPeopleIdentity,
  withAuthorizedPeopleTransaction,
} from "../people/authorization/context.js";
import { newPeopleId } from "../people/persistence/id.js";

/** Internal-only contract. No route imports this module or binds fixture identities. */
export interface ReservationScope {
  readonly identity: TrustedPeopleIdentity;
  readonly organizationId: string;
  readonly venueId: string;
}
export interface AvailabilityQuery {
  date: string;
  partySize: number;
  fromMinute?: number;
  toMinute?: number;
}
export interface ReservationSlot {
  tableId: string;
  shiftId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
}
export interface CreateReservation {
  date: string;
  partySize: number;
  tableId: string;
  shiftId: string;
  startsAt: string;
  guestName: string;
  guestEmail: string;
  idempotencyKey: string;
}
export interface Reservation extends ReservationSlot {
  id: string;
  clientId: string;
  organizationId: string;
  venueId: string;
  date: string;
  partySize: number;
  guestName: string;
  guestEmail: string;
  status: "BOOKED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
}
type ErrorCode =
  | "INVALID_INPUT"
  | "ACCESS_DENIED"
  | "NOT_FOUND"
  | "CAPACITY_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL";
export class ReservationError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}
const invalid = () => {
  throw new ReservationError("INVALID_INPUT");
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value: unknown): string {
  if (typeof value !== "string" || !uuid.test(value)) return invalid();
  return value.toLowerCase();
}
function day(value: unknown): string {
  if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value))
    return invalid();
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    return invalid();
  return value;
}
function party(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 50
  )
    return invalid();
  return value;
}
function text(value: unknown, max: number): string {
  if (
    typeof value !== "string" ||
    value.length > max * 2 ||
    Array.from(value).some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return (
        code < 32 ||
        (code >= 127 && code <= 159) ||
        (code >= 0xd800 && code <= 0xdfff)
      );
    })
  )
    return invalid();
  const normalized = value.trim();
  if (!normalized || Array.from(normalized).length > max) return invalid();
  return normalized;
}
function instant(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.000)?Z$/.test(value)
  )
    return invalid();
  const result = new Date(value);
  if (
    !Number.isFinite(result.getTime()) ||
    result.toISOString() !==
      value.replace(/Z$/, value.includes(".") ? "Z" : ".000Z")
  )
    return invalid();
  return result.toISOString();
}
async function authorized<T>(
  pool: Pool,
  scope: ReservationScope,
  permission: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  try {
    id(scope.venueId);
    return await withAuthorizedPeopleTransaction(
      pool,
      scope.identity,
      {
        organizationId: scope.organizationId,
        venueId: scope.venueId,
        permissionId: permission,
      },
      async (client) => {
        const check = await client.query(
          "SELECT reservation_allowed($1) AS allowed",
          [permission],
        );
        if (check.rows[0]?.allowed !== true)
          throw new ReservationError("ACCESS_DENIED");
        return work(client);
      },
    );
  } catch (error) {
    if (error instanceof ReservationError) throw error;
    if (error instanceof PeopleAccessDenied)
      throw new ReservationError("ACCESS_DENIED");
    const code = (error as { code?: string })?.code;
    if (code === "23P01") throw new ReservationError("CAPACITY_CONFLICT");
    if (code === "42501") throw new ReservationError("ACCESS_DENIED");
    if (code === "23514" || code === "22P02")
      throw new ReservationError("INVALID_INPUT");
    // Never expose database detail, query parameters or guest data to callers/logs.
    throw new ReservationError("INTERNAL");
  }
}
const slotColumns = `x.table_id AS "tableId",x.shift_id AS "shiftId",x.starts_at AS "startsAt",x.ends_at AS "endsAt",x.timezone`;
type SlotRow = Omit<ReservationSlot, "startsAt" | "endsAt"> & {
  startsAt: Date;
  endsAt: Date;
};
const slotDto = (row: SlotRow): ReservationSlot => ({
  ...row,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt.toISOString(),
});
const reservationColumns = `id,client_id AS "clientId",organization_id AS "organizationId",venue_id AS "venueId",
 table_id AS "tableId",shift_id AS "shiftId",starts_at AS "startsAt",ends_at AS "endsAt",timezone,
 to_char(local_date,'YYYY-MM-DD') AS date,party_size AS "partySize",guest_name AS "guestName",guest_email AS "guestEmail",
 status,created_at AS "createdAt",updated_at AS "updatedAt"`;
type ReservationRow = Omit<
  Reservation,
  "startsAt" | "endsAt" | "createdAt" | "updatedAt"
> & { startsAt: Date; endsAt: Date; createdAt: Date; updatedAt: Date };
const dto = (r: ReservationRow): Reservation => ({
  ...r,
  startsAt: r.startsAt.toISOString(),
  endsAt: r.endsAt.toISOString(),
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export async function searchAvailability(
  pool: Pool,
  scope: ReservationScope,
  input: AvailabilityQuery,
): Promise<ReservationSlot[]> {
  const date = day(input.date),
    size = party(input.partySize),
    from = input.fromMinute ?? 0,
    to = input.toMinute ?? 1440;
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to > 1440 ||
    from >= to
  )
    return invalid();
  return authorized(pool, scope, "reservation.read", async (client) => {
    const result = await client.query<SlotRow>(
      `SELECT ${slotColumns} FROM reservation_slots($1,$2) x
      WHERE extract(hour FROM x.starts_at AT TIME ZONE x.timezone)*60+extract(minute FROM x.starts_at AT TIME ZONE x.timezone)>=$3
      AND extract(hour FROM x.starts_at AT TIME ZONE x.timezone)*60+extract(minute FROM x.starts_at AT TIME ZONE x.timezone)<$4
      AND NOT EXISTS(SELECT 1 FROM reservations r WHERE r.table_id=x.table_id AND r.status='BOOKED'
        AND tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(x.starts_at,x.ends_at,'[)'))
      ORDER BY x.starts_at,x.table_id,x.shift_id`,
      [date, size, from, to],
    );
    return result.rows.map(slotDto);
  });
}
export async function createReservation(
  pool: Pool,
  scope: ReservationScope,
  input: CreateReservation,
): Promise<Reservation> {
  const value = {
    date: day(input.date),
    partySize: party(input.partySize),
    tableId: id(input.tableId),
    shiftId: id(input.shiftId),
    startsAt: instant(input.startsAt),
    guestName: text(input.guestName, 120),
    guestEmail: text(input.guestEmail, 254),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.guestEmail)) return invalid();
  const key = id(input.idempotencyKey),
    fingerprint = createHash("sha256")
      .update(JSON.stringify(value))
      .digest("hex");
  return authorized(pool, scope, "reservation.create", async (client) => {
    // Transaction-scoped serialization of a command key, not a synthetic auth seam.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${scope.organizationId}/${scope.venueId}/${scope.identity.userId}/${key}`,
    ]);
    const prior = await client.query<ReservationRow & { fingerprint: string }>(
      `SELECT ${reservationColumns},request_fingerprint AS fingerprint FROM reservations
      WHERE organization_id=$1 AND venue_id=$2 AND created_by_user_id=$3 AND idempotency_key=$4`,
      [scope.organizationId, scope.venueId, scope.identity.userId, key],
    );
    const existing = prior.rows[0];
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new ReservationError("IDEMPOTENCY_CONFLICT");
      const { fingerprint: _fingerprint, ...record } = existing;
      return dto(record);
    }
    const found = await client.query<SlotRow>(
      `SELECT ${slotColumns} FROM reservation_slots($1,$2) x WHERE x.table_id=$3 AND x.shift_id=$4 AND x.starts_at=$5`,
      [
        value.date,
        value.partySize,
        value.tableId,
        value.shiftId,
        value.startsAt,
      ],
    );
    const slot = found.rows[0];
    if (!slot) throw new ReservationError("CAPACITY_CONFLICT");
    const clientId = newPeopleId();
    await client.query(
      "INSERT INTO reservation_clients(id,organization_id) VALUES($1,$2)",
      [clientId, scope.organizationId],
    );
    const created = await client.query<ReservationRow>(
      `INSERT INTO reservations(id,organization_id,venue_id,client_id,table_id,shift_id,
      guest_name,guest_email,party_size,starts_at,ends_at,local_date,timezone,created_by_user_id,idempotency_key,request_fingerprint)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING ${reservationColumns}`,
      [
        newPeopleId(),
        scope.organizationId,
        scope.venueId,
        clientId,
        value.tableId,
        value.shiftId,
        value.guestName,
        value.guestEmail,
        value.partySize,
        value.startsAt,
        slot.endsAt,
        value.date,
        slot.timezone,
        scope.identity.userId,
        key,
        fingerprint,
      ],
    );
    const record = created.rows[0];
    if (!record) throw new ReservationError("INTERNAL");
    return dto(record);
  });
}
export async function getReservation(
  pool: Pool,
  scope: ReservationScope,
  reservationId: string,
): Promise<Reservation> {
  id(reservationId);
  return authorized(pool, scope, "reservation.read", async (client) => {
    const result = await client.query<ReservationRow>(
      `SELECT ${reservationColumns} FROM reservations WHERE id=$1 AND organization_id=$2 AND venue_id=$3`,
      [reservationId, scope.organizationId, scope.venueId],
    );
    const record = result.rows[0];
    if (!record) throw new ReservationError("NOT_FOUND");
    return dto(record);
  });
}
export async function listReservations(
  pool: Pool,
  scope: ReservationScope,
  date: string,
  limit = 100,
): Promise<Reservation[]> {
  day(date);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) return invalid();
  return authorized(pool, scope, "reservation.read", async (client) => {
    const result = await client.query<ReservationRow>(
      `SELECT ${reservationColumns} FROM reservations WHERE organization_id=$1 AND venue_id=$2 AND local_date=$3 ORDER BY starts_at,id LIMIT $4`,
      [scope.organizationId, scope.venueId, date, limit],
    );
    return result.rows.map(dto);
  });
}
export async function cancelReservation(
  pool: Pool,
  scope: ReservationScope,
  reservationId: string,
): Promise<Reservation> {
  id(reservationId);
  return authorized(pool, scope, "reservation.cancel", async (client) => {
    const result = await client.query<ReservationRow>(
      `UPDATE reservations SET status='CANCELLED' WHERE id=$1 AND organization_id=$2 AND venue_id=$3 AND status='BOOKED' RETURNING ${reservationColumns}`,
      [reservationId, scope.organizationId, scope.venueId],
    );
    let record = result.rows[0];
    if (!record) {
      const existing = await client.query<ReservationRow>(
        `SELECT ${reservationColumns} FROM reservations WHERE id=$1 AND organization_id=$2 AND venue_id=$3`,
        [reservationId, scope.organizationId, scope.venueId],
      );
      record = existing.rows[0];
    }
    if (!record) throw new ReservationError("NOT_FOUND");
    return dto(record);
  });
}
