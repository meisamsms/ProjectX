# Internal reservation domain — RESERVATION-DOMAIN-001 / 002

ProjectX implementation contract under ADR-0018 and ADR-0019, not reference-application behavior. The service is internal TypeScript in `apps/api/src/reservations/service.ts`; it exposes no HTTP route or browser authentication bypass.

## Operations and boundaries

All operations require a branded trusted identity, explicit Organization/Venue scope, an active membership/VenueAccess and current permissions. Use the existing restricted runtime pool. Tests bind synthetic identities in the test fixture only. Read permission is required for every operation; creation additionally requires `reservation.create`, cancellation `reservation.cancel`.

| Operation | Input and outcome |
| --- | --- |
| searchAvailability | Venue scope plus local date, party size, optional local minute window `[fromMinute,toMinute)`. Returns eligible table/shift/UTC start/end/timezone slots, ordered by start/table/shift. This is a snapshot; creation revalidates it. |
| createReservation | Selected table/shift/start, local date, party size, guest name, required email, UUID idempotency key. Atomically creates minimal client identity, reservation and CREATED metadata. |
| getReservation | Scoped ID lookup; inaccessible records return NOT_FOUND after scope authorization. |
| listReservations | Explicit Venue-local date; ordered by UTC start/ID, default limit 100, maximum 500. No cross-venue guest directory. |
| cancelReservation | BOOKED → CANCELLED, with transactional audit and capacity release. Repeated cancellation returns the same cancelled record. |
| modifyReservation | Scoped reservation ID, expectedRevision, modification idempotency key and complete target date/start/table/shift/party allocation. Requires current read + update permissions. Atomic revisioned allocation change; returns original command result on retry. |

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
capacity. The same `-t DEMONSTRATION` command runs both synthetic demonstrations.

Run the whole focused suite without `-t DEMONSTRATION`, then `pnpm verify:db` and `pnpm verify`. Database suites must not reset the same schema concurrently. CI already invokes the full database runner, which includes this focused suite. CHK-081 and CHK-082 record actual results and environment identity.

This is an internal domain demonstration. Public booking, check-in/seating, confirmation delivery, browser integration and live staff-provider verification remain outside this package. CORE-READY-01 remains unmet.
