# Internal reservation domain, Staff HTTP API & Staff Reservation Book UI — RESERVATION-DOMAIN-001 / 002 / 003 / 004 / 005

ProjectX implementation contract under ADR-0018, ADR-0019, ADR-0020, ADR-0021 and ADR-0022, not reference-application behavior. The domain service is in `apps/api/src/reservations/service.ts`, the authenticated staff HTTP routes are in `apps/api/src/reservations/route.ts` under `/api/v1/staff/reservations`, and the staff browser reservation book (`SCR-002`/`SCR-003`/`SCR-139`) is in `apps/web/src/reservations/page.tsx` and `apps/web/src/reservations/client.ts`; no public guest widget route or browser authentication bypass is exposed.

## Operations and boundaries

All operations require a branded trusted identity, explicit Organization/Venue scope, an active membership/VenueAccess and current permissions. Use the existing restricted runtime pool. Tests bind synthetic identities in the test fixture only. Read permission is required for every operation; creation additionally requires `reservation.create`, modification `reservation.update`, check-in `reservation.checkin`, seating `reservation.seat`, and cancellation `reservation.cancel`.

| Operation | Input and outcome |
| --- | --- |
| searchAvailability | Venue scope plus local date, party size, optional local minute window `[fromMinute,toMinute)`. Returns eligible table/shift/UTC start/end/timezone slots, ordered by start/table/shift. Excludes overlapping `BOOKED`, `CHECKED_IN` and `SEATED` allocations. This is a snapshot; creation revalidates it. |
| createReservation | Selected table/shift/start, local date, party size, guest name, required email, UUID idempotency key. Atomically creates minimal client identity, reservation and CREATED metadata. |
| getReservation | Scoped ID lookup; inaccessible records return NOT_FOUND after scope authorization. |
| listReservations | Explicit Venue-local date; ordered by UTC start/ID, default limit 100, maximum 500. No cross-venue guest directory. |
| cancelReservation | BOOKED → CANCELLED, with transactional audit and capacity release. Repeated cancellation of CANCELLED returns the same cancelled record; attempting to cancel CHECKED_IN or SEATED returns INVALID_STATE. |
| modifyReservation | Scoped reservation ID, expectedRevision, modification idempotency key and complete target date/start/table/shift/party allocation. Requires current read + update permissions. Only BOOKED reservations can be modified. Atomic revisioned allocation change; returns original command result on retry. |
| checkInReservation | Scoped reservation ID, expectedRevision and UUID idempotency key. Requires current `reservation.read` + `reservation.checkin`. Atomically transitions BOOKED → CHECKED_IN, increments `revision`, retains table/shift/time/party capacity, and records immutable command/audit metadata in `reservation_modifications`. |
| seatReservation | Scoped reservation ID, expectedRevision and UUID idempotency key. Requires current `reservation.read` + `reservation.seat`. Atomically transitions CHECKED_IN → SEATED, increments `revision`, retains table/shift/time/party capacity, and records immutable command/audit metadata in `reservation_modifications`. |

Party size is an integer 1–50; table and shift limits may be smaller. Dates and UTC timestamps are validated, with service date range 2000–2099. Name/email are trimmed and reject controls; lengths are bounded at 120/254 Unicode characters. Required email uses a minimal syntax check, not delivery verification. Configuration is migration-owner/fixture managed and runtime read-only. Date-specific, non-overnight shifts use local opening/closing minutes, elapsed duration 15–480 minutes and slot step 5–120 minutes. Table combination, pacing, recurring schedules, full settings editors and graphical floorplans are excluded.

DOMAIN-001's six physical tables are `reservation_venue_settings`, `reservation_tables`, `reservation_shifts`, `reservation_clients`, `reservations`, and `reservation_changes`. DOMAIN-002 adds `reservation_modifications` for immutable command/audit evidence. The entity registry cross-references existing stable IDs without changing reference confidence. Organization-owned client IDs contain no contact details; the reservation holds its Venue-scoped contact snapshot. No automatic guest matching or deduplication is inferred.

## Correctness

PostgreSQL's `reservation_no_overlap` GiST exclusion constraint rejects overlapping active allocations for the same table, even across separate runtime connections. Intervals are half-open `[start,end)`, so adjacent bookings are allowed. Configuration rows are share-locked and the write trigger rechecks eligibility. A failed reservation or audit write rolls back the client, reservation and key together.

An advisory transaction lock serializes a command key. A unique Organization/Venue/actor/key constraint and normalized payload fingerprint ensure retries return the same record, including after cancellation; changed payloads return IDEMPOTENCY_CONFLICT. Different keys still compete for capacity at the database constraint. Keys persist for the record's lifetime; there is no TTL reuse or automatic unbounded retry.

Stable domain errors are INVALID_INPUT, ACCESS_DENIED, NOT_FOUND, CAPACITY_CONFLICT, IDEMPOTENCY_CONFLICT, VERSION_CONFLICT, INVALID_STATE and INTERNAL. Database details and guest data are not logged or exposed in these errors. No generic export audit subsystem was added; successful CREATED/CANCELLED metadata is recorded by a restricted trigger path in the same transaction. Durable denied-attempt audit is outside this local slice.

## Atomic modification contract (DOMAIN-002)

Only BOOKED reservations can change allocation. Reservation ID, client/guest/contact,
Organization/Venue, creation timestamp and creation key/fingerprint are immutable.
`revision` starts at 1, including migrated DOMAIN-001 rows. Each modification and
first cancellation increments it; cancellation retries do not. Even a same-allocation
modification consumes one revision. `expectedRevision` is an integer from 1 through
2147483646. A stale new command returns VERSION_CONFLICT; a cancelled reservation
returns INVALID_STATE. Allocation inputs use the existing date/UTC/party/UUID validation.
End time and timezone always come from locked configuration, never caller fields.

`reservation_modify` is a narrow, explicitly authorized SECURITY DEFINER function
with a fixed trusted search path and PUBLIC execution revoked. It enforces current
read/update access and tenant/Venue scope, locks the key then the reservation, and
rechecks permissions after waiting. Direct runtime UPDATE grants and RLS UPDATE
policy remain cancellation-only. An update-only actor cannot cancel. The write
trigger independently validates the slot and immutable fields and requires exact
protected command evidence for a BOOKED allocation update. The exclusion constraint
continues to prevent overlaps. A failed move leaves the original allocation,
revision and availability unchanged and consumes no command key.

| Situation | Result |
| --- | --- |
| Same scoped modification key and normalized request | Original result snapshot, including original resulting revision/status/timestamp, even after later edits or cancellation. Current permissions are still required. Use getReservation for current state. |
| Same key, different payload (including another accessible reservation) | IDEMPOTENCY_CONFLICT. Inaccessible/nonexistent target lookup remains NOT_FOUND. |
| Two keys modifying one revision | Row lock serializes; one succeeds, other returns VERSION_CONFLICT. |
| Competing reservations for constrained capacity | At most one commits; other returns CAPACITY_CONFLICT with original booking intact. PostgreSQL allocation deadlock also maps to CAPACITY_CONFLICT; no automatic retries. |
| Modification versus cancellation | Same row lock: modification either precedes cancellation or rejects CANCELLED; never resurrects. |
| Audit/constraint failure | Entire transaction rolls back, including command evidence and revision. Safe explicit retry may reuse the key. |

Modification keys are separate from create keys and unique by Organization/Venue/
actor/key, retained for record lifetime. Typed normalized request JSON is generated
inside PostgreSQL, not supplied as a trusted fingerprint. The immutable command
table stores actor, request, before/after allocation and timestamps without copying
guest PII. Runtime has no direct ledger SELECT/INSERT/UPDATE/DELETE/TRUNCATE rights.
RLS and composite ownership FKs remain enabled. Existing creation/cancellation
audit stays immutable and cancellation requires its own permission.

UTC instants are canonical. Local dates and IANA timezone are retained. Slots follow elapsed UTC time between resolved local shift boundaries. Nonexistent spring times are absent; repeated autumn times are separate UTC slots. Nonexistent shift boundaries produce no availability; ambiguous boundaries use PostgreSQL's standard-time interpretation. These are explicit ProjectX rules, not inferred reference behavior.

## Check-in and seating contract (DOMAIN-003)

`checkInReservation` (`BOOKED -> CHECKED_IN`) and `seatReservation` (`CHECKED_IN -> SEATED`) are internal staff lifecycle transitions defined under ADR-0020. No skipped check-in (`BOOKED -> SEATED`), reversal (`SEATED -> CHECKED_IN`, `CHECKED_IN -> BOOKED`), reactivation (`CANCELLED -> *`), checkout, no-show or completion is supported. Both transitions require `reservation.read` plus their respective explicit Venue-scoped permission (`reservation.checkin` or `reservation.seat`), neither of which is implied by `reservation.update` or `reservation.cancel`. Neither permission is auto-granted to existing roles or users.

`reservation_transition` is a narrow `SECURITY DEFINER` function with a fixed trusted search path (`projectx_test, pg_catalog, pg_temp`) and PUBLIC execution revoked. It validates scope and current permissions, acquires the shared `'reservation.modify/'||org||'/'||venue||'/'||actor||'/'||command_key` advisory lock, locks the reservation row (`FOR UPDATE`), and rechecks permissions after waiting. It reuses `reservation_modifications` for idempotent command replay and PII-free before/after status and revision audit metadata. Same key and payload replay the original transition snapshot even if the reservation later advanced to `SEATED`; reusing a key with a different reservation, expected revision or operation (`CHECK_IN`, `SEAT`, `MODIFY`) returns `IDEMPOTENCY_CONFLICT`.

All three active states (`BOOKED`, `CHECKED_IN`, `SEATED`) retain table/shift/time/party capacity in both `searchAvailability` and the `reservation_no_overlap` GiST exclusion constraint. Attempting to modify or cancel a `CHECKED_IN` or `SEATED` reservation returns `INVALID_STATE` and leaves persisted state, revision and capacity unchanged.

## Authenticated Staff Reservation HTTP API (DOMAIN-004)

`apps/api/src/reservations/route.ts` mounts the authenticated staff reservation HTTP endpoints under `/api/v1/staff/reservations` (`ADR-0021`):

- `GET /api/v1/staff/reservations/availability` (`searchAvailability`, requires `reservation.read`)
- `GET /api/v1/staff/reservations` (`listReservations`, requires `reservation.read`)
- `POST /api/v1/staff/reservations` (`createReservation`, requires `reservation.read` + `reservation.create`)
- `GET /api/v1/staff/reservations/:id` (`getReservation`, requires `reservation.read`)
- `PATCH /api/v1/staff/reservations/:id` (`modifyReservation`, requires `reservation.read` + `reservation.update`)
- `POST /api/v1/staff/reservations/:id/check-in` (`checkInReservation`, requires `reservation.read` + `reservation.checkin`)
- `POST /api/v1/staff/reservations/:id/seat` (`seatReservation`, requires `reservation.read` + `reservation.seat`)
- `POST /api/v1/staff/reservations/:id/cancel` (`cancelReservation`, requires `reservation.read` + `reservation.cancel`)

Every endpoint is protected by `registerStaffAuth` (`apps/api/src/staff-auth/routes.ts`), enforcing `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, canonical `Host` (rejecting `X-Forwarded-Host`), active `__Host-projectx-session` cookie, server-derived `organizationId` + `venueId` (`403` when `venueId` is null), and on `POST`/`PATCH` mutations validated same-origin `Origin`/`Referer`, session-bound `X-ProjectX-CSRF`, and `X-ProjectX-Context-Version` (`409` when stale). Domain errors map deterministically (`INVALID_INPUT` -> `400`, `ACCESS_DENIED` -> `403`, `NOT_FOUND` -> `404`, `CAPACITY_CONFLICT`/`IDEMPOTENCY_CONFLICT`/`VERSION_CONFLICT`/`INVALID_STATE` -> `409`, `INTERNAL` -> `500`) without exposing SQL, credentials, or guest PII.

## Executable synthetic demonstration

Use a disposable PostgreSQL 16 database ending in `_test`. Fixtures reset its `projectx_test` schema and create/drop a test runtime login, so never use a shared or production database. Set `DATABASE_URL` to that isolated database and, in PowerShell:

```powershell
$env:TEST_DATABASE = '1'
$env:NODE_ENV = 'test'
pnpm db:check
pnpm exec vitest run apps/api/tests/reservations/domain.test.ts --no-file-parallelism --reporter=verbose -t DEMONSTRATION
```

The test uses Test Restaurant, a valid future Venue-local date, two guests and a capacity-two table. It selects a returned slot, creates a persisted reservation, verifies that slot becomes unavailable, retrieves/lists it through authorized staff-domain reads, cancels it, and asserts that the original availability returns. It prints only a fixed synthetic success message, with no guest data.

The DOMAIN-002 demonstration in the same file creates, modifies, verifies the old
slot is released and the new slot occupied, retrieves the updated reservation,
rejects a failed modification without changing it, then cancels and restores
capacity.

The DOMAIN-003 demonstration in the same file creates a reservation, checks it in
(`CHECKED_IN`, revision 2), verifies capacity remains occupied, seats it (`SEATED`,
revision 3), verifies staff `getReservation`/`listReservations` return the seated
record while capacity remains protected, and verifies invalid post-seating transitions
(`checkInReservation`, `modifyReservation`, `cancelReservation`) fail with
`INVALID_STATE` while preserving persisted state. The `-t DEMONSTRATION` command
runs all three synthetic demonstrations.

The DOMAIN-004 HTTP demonstration in `apps/api/tests/reservations/http.test.ts`
issues a PostgreSQL-backed staff session and executes availability search,
reservation creation (`201`), get (`200`), list (`200`), modification (`200`),
check-in (`200`), seating (`200`), and cancellation (`200`) over `/api/v1/staff/reservations`
with full CSRF, Origin/Host, and context-version headers.

Run the whole focused suite without `-t DEMONSTRATION`, then `pnpm verify:db` and `pnpm verify`. Database suites must not reset the same schema concurrently. CI already invokes the full database runner, which includes both focused suites. CHK-081, CHK-082, CHK-084, CHK-085 and CHK-086 record actual results and environment identity.

## Staff Reservation Book UI (DOMAIN-005)

`apps/web/src/shell.tsx` wires `SCR-002` (`/manager/oceansatarthurs/reservations/day/:date`) to `<ReservationsBookPage />` (`apps/web/src/reservations/page.tsx`) using `apps/web/src/reservations/client.ts` (`ADR-0022`):

- **SCR-002**: Loads reservations (`listStaffReservations`) and availability (`searchStaffReservationAvailability`) for the Venue-local date, with filtering by date, party size, and optional time window (`fromMinute`, `toMinute`).
- **SCR-003**: Creates a reservation from a selected available slot (`createStaffReservation`) with local guest name/email validation and draft-bound UUID `idempotencyKey`.
- **SCR-139**: Displays reservation detail and supports modifying date/party size/time/table/shift (`modifyStaffReservation`), check-in (`checkInStaffReservation`), seating (`seatStaffReservation`), and cancellation (`cancelStaffReservation`).
- **Security and error handling**: Uses `staffFetch` with server-derived Organization/Venue scope (never trusting the URL venue slug), redacts internal server error details, preserves unsaved create/modify drafts on `400`/`401`/`403`/`404`/`409`/`500`, and requires explicit confirmation before discarding dirty drafts on refresh.

Public guest booking, confirmation delivery and live staff-provider verification remain outside this package. CORE-READY-01 remains unmet.
