# ADR-0023 — Public Guest Booking Boundary Contract (`RESERVATION-DOMAIN-006`)

Status: ACCEPTED (ProjectX contract decision, verified by CHK-087). Owner
explicitly authorized this bounded prerequisite specification (`RESERVATION-DOMAIN-006`)
to resolve the public guest booking security, database, and API boundary before
implementing public reservation endpoints and the `SCR-072` widget. This is a
ProjectX contract building on `ADR-0018`–`ADR-0022` (`CHK-081`–`CHK-086`), not
inferred reference-application behavior.

---

## 1. Public Venue Lookup & Minimal Booking Settings (No Tenant Enumeration)

- **Source of truth**: `reservation_venue_settings` (migration-owner/fixture-managed,
  runtime read-only) is extended additively with:
  - `public_slug text NULL UNIQUE CHECK (public_slug IS NULL OR (char_length(public_slug) BETWEEN 3 AND 64 AND public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'))`
  - `public_booking_enabled boolean NOT NULL DEFAULT false`
- **Resolution & non-enumeration**: Public endpoints accept only `:venueSlug` in
  the URL path—never `organizationId` or `venueId` UUIDs. Only a Venue with
  `public_booking_enabled = true` and matching `public_slug` resolves; unknown,
  unconfigured, or disabled slugs fail closed with `404 NOT_FOUND` (`P1001`) and
  an identical generic error body. No public Venue directory/list endpoint is
  exposed.
- **Minimal settings boundary**: Per-Venue `timezone`, `public_slug`,
  `public_booking_enabled`, active `reservation_tables` (`capacity 1..50`), and
  dated `reservation_shifts` (`open_minute`, `close_minute`, `duration_minutes`,
  `step_minutes`, `min_party`, `max_party`) in `reservation_venue_settings`,
  `reservation_tables`, and `reservation_shifts` are the sole booking policy
  inputs. Full `SETTINGS-CORE-01` and `LANGUAGE-CORE-01` editors remain out of
  scope.

## 2. Purpose-Limited Public Availability Projection

- **Endpoint**: `GET /api/v1/public/venues/{venueSlug}/availability?date=YYYY-MM-DD&partySize=N&fromMinute=...&toMinute=...`
- **Database boundary**: Narrow `SECURITY DEFINER` function
  `reservation_public_availability(requested_slug text, requested_day date, requested_party integer, from_minute integer, to_minute integer)`
  with `SET search_path = projectx_test, pg_catalog, pg_temp` and `PUBLIC`
  execution revoked (`GRANT EXECUTE` only to `projectx_people_runtime`).
- **Projection**: Evaluates the same timezone/DST shift-slot rules and active
  table exclusion (`status IN ('BOOKED', 'CHECKED_IN', 'SEATED')`) as internal
  `reservation_slots`, deduplicated by `(starts_at, ends_at, timezone)` ordered
  by `starts_at ASC`.
- **Redaction**: Returns only `{ venue: { slug, name, timezone }, items: [{ startsAt, endsAt, timezone }] }`.
  Internal `organizationId`, `venueId`, `tableId`, `shiftId`, table labels, and
  all guest/reservation records are strictly excluded.

## 3. Guest Reservation Creation, Narrow DB Authorization & RLS Preservation

- **No fabricated staff identities**: Public guest bookings never create or bind
  a synthetic `users` row or `TrustedPeopleIdentity`.
- **Schema boundary**:
  - `reservations` adds `booking_source text NOT NULL DEFAULT 'STAFF' CHECK (booking_source IN ('STAFF', 'PUBLIC_WIDGET'))`.
  - `reservations.created_by_user_id` becomes nullable under
    `CHECK ((booking_source = 'STAFF' AND created_by_user_id IS NOT NULL) OR (booking_source = 'PUBLIC_WIDGET' AND created_by_user_id IS NULL))`.
  - `reservation_changes` adds `actor_kind text NOT NULL DEFAULT 'STAFF'` and
    makes `actor_user_id` nullable under
    `CHECK ((actor_kind = 'STAFF' AND actor_user_id IS NOT NULL) OR (actor_kind = 'GUEST' AND actor_user_id IS NULL))`.
- **RLS & privilege preservation**: Direct table grants and RLS policies on all
  seven reservation tables remain staff-only (`reservation_allowed(...)`). The
  runtime role cannot directly `SELECT` or `INSERT` into `reservations` without
  staff session context.
- **Narrow write entry point**: `reservation_public_create(requested_slug text, requested_day date, requested_party integer, requested_start timestamptz, guest_name text, guest_email text, command_key uuid, request_hash text)`
  is a `SECURITY DEFINER` function (`SET search_path = projectx_test, pg_catalog, pg_temp`)
  that resolves the enabled Venue by `requested_slug`, sets a transaction-local
  guard recognized by `reservation_validate()` and `reservation_record_change()`
  exclusively for `INSERT` where `booking_source = 'PUBLIC_WIDGET'` and
  `created_by_user_id IS NULL`, and atomically inserts `reservation_clients`,
  `reservations` (`status = 'BOOKED'`, `revision = 1`), and `reservation_changes`
  (`action = 'CREATED'`, `actor_kind = 'GUEST'`).
- **Immediate staff visibility**: Because the booking is stored in `reservations`
  under the Venue's `(organization_id, venue_id)`, authenticated staff with
  `reservation.read` immediately see it in `/api/v1/staff/reservations` and
  `SCR-002`/`SCR-139` and can modify, check in, seat, or cancel it.

## 4. Server-Side Capacity Revalidation & Double-Booking Prevention

- Callers submit only `(date, partySize, startsAt, guestName, guestEmail, idempotencyKey)`—never
  `tableId` or `shiftId`.
- Inside `reservation_public_create`, PostgreSQL share-locks the Venue's
  settings, shifts, and candidate tables (`FOR SHARE`), deterministically selects
  the best-fit available `(table_id, shift_id, ends_at, timezone)` at
  `requested_start` ordered by `t.capacity ASC, t.id ASC, s.id ASC` with no
  overlapping `BOOKED`/`CHECKED_IN`/`SEATED` reservation, and relies on the
  `reservation_no_overlap` GiST exclusion constraint (`23P01` -> `CAPACITY_CONFLICT`)
  as the final concurrency guard. If no table is available, it raises `P1005`
  (`409 CAPACITY_CONFLICT`).

## 5. Venue-Scoped Guest Idempotency, Retry & Conflict Behavior

- A partial unique index `reservations_public_idempotency_idx ON reservations(organization_id, venue_id, idempotency_key) WHERE booking_source = 'PUBLIC_WIDGET'`
  and transaction-local advisory lock `'reservation.public.create/' || org || '/' || venue || '/' || command_key`
  serialize guest retries per Venue.
- `request_fingerprint` is the SHA-256 hash of normalized
  `date | partySize | startsAt | guestName | lower(guestEmail)`.
- Replaying the same `idempotencyKey` at the same Venue with an identical
  normalized payload returns the deterministic `201` confirmation snapshot
  (even if staff subsequently modified, checked in, seated, or cancelled the
  reservation). Reusing the same `idempotencyKey` with a different payload
  returns `409 IDEMPOTENCY_CONFLICT` (`P1002`).

## 6. Rate Limiting, Input Validation, Privacy & Honest Confirmation Response

- **Validation & headers**: `POST /api/v1/public/venues/{venueSlug}/reservations`
  and `GET .../availability` set `Cache-Control: no-store` and
  `Referrer-Policy: no-referrer`, validate canonical `Host` (rejecting
  `X-Forwarded-Host` with `403`), reject unknown/duplicate fields (`400`),
  validate `guestName` (`1..120` chars, no controls) and `guestEmail` (`3..254`
  chars, syntax check), and redact all SQL/internal details on `500`.
- **Rate limiting**: Bounded per-IP + `:venueSlug` token-bucket rate limiter on
  public routes returns `429 TOO_MANY_REQUESTS` (`RATE_LIMITED`) when exceeded.
- **No public read/modify/cancel by ID**: Public endpoints do not expose
  reservation lookup, modification, or cancellation by ID, preventing guest PII
  enumeration.
- **Confirmation response (`201 Created`)**: Returns only
  `{ reservationId, venueSlug, venueName, date, startsAt, endsAt, timezone, partySize, guestName, status: "BOOKED", confirmationDelivery: "NONE" }`.
  Both the API contract and browser UI explicitly state that no email/SMS
  confirmation delivery is performed in this slice.

---

## 7. Bounded Two-Package Delivery Plan

1. **Package A — `RESERVATION-DOMAIN-007` (Public Guest Booking Backend & PostgreSQL Security Slice)**:
   - **Prerequisites**: `RESERVATION-DOMAIN-006` (`VERIFIED`), `RESERVATION-DOMAIN-004` (`VERIFIED`), `DB-HARNESS-001` (`VERIFIED`).
   - **Owned paths**: `apps/api/migrations/zz-reservation-domain/20261027001300_public_guest_booking.sql`, `apps/api/src/reservations/service.ts`, `apps/api/src/reservations/public-route.ts`, `apps/api/src/app.ts`, `packages/contracts/openapi.json`, `packages/contracts/generated/api.ts`, `apps/api/tests/reservations/public-http.test.ts`, affected migration-ledger inventory lists, and map/evidence docs (`CHK-088`).
   - **Verification**: Real PostgreSQL 16 tests covering public availability redaction, guest create -> staff visibility/lifecycle, concurrency/double-booking prevention, guest idempotency/conflict, unknown/disabled slug `404`, RLS/privilege isolation, rate limiting (`429`), `pnpm verify:db`, and `pnpm verify`.
2. **Package B — `RESERVATION-DOMAIN-008` (Public Reservation Widget Browser UI `SCR-072`)**:
   - **Prerequisites**: `RESERVATION-DOMAIN-007` (`VERIFIED`), `RESERVATION-DOMAIN-005` (`VERIFIED`), `FOUND-TASK-004` (`VERIFIED`).
   - **Owned paths**: `apps/web/src/reservations/widget-client.ts`, `apps/web/src/reservations/widget-page.tsx`, `apps/web/src/shell.tsx` (`SCR-072`), `apps/web/tests/reservations/widget.test.tsx`, `tests/e2e/reservations-widget.spec.ts`, and map/evidence docs (`CHK-089`).
   - **Verification**: Focused Vitest, Playwright E2E + `@axe-core/playwright` zero violations (Venue/date/party search, slot selection, guest form validation, idempotent booking confirmation with explicit `confirmationDelivery: "NONE"` notice, `400`/`404`/`409`/`429`/`500` draft retention), and full `pnpm verify`.
