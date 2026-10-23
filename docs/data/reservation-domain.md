# Internal reservation domain — RESERVATION-DOMAIN-001

ProjectX implementation contract under ADR-0018, not reference-application behavior. The service is internal TypeScript in `apps/api/src/reservations/service.ts`; it exposes no HTTP route or browser authentication bypass.

## Operations and boundaries

All operations require a branded trusted identity, explicit Organization/Venue scope, an active membership/VenueAccess and current permissions. Use the existing restricted runtime pool. Tests bind synthetic identities in the test fixture only. Read permission is required for every operation; creation additionally requires `reservation.create`, cancellation `reservation.cancel`.

| Operation | Input and outcome |
| --- | --- |
| searchAvailability | Venue scope plus local date, party size, optional local minute window `[fromMinute,toMinute)`. Returns eligible table/shift/UTC start/end/timezone slots, ordered by start/table/shift. This is a snapshot; creation revalidates it. |
| createReservation | Selected table/shift/start, local date, party size, guest name, required email, UUID idempotency key. Atomically creates minimal client identity, reservation and CREATED metadata. |
| getReservation | Scoped ID lookup; inaccessible records return NOT_FOUND after scope authorization. |
| listReservations | Explicit Venue-local date; ordered by UTC start/ID, default limit 100, maximum 500. No cross-venue guest directory. |
| cancelReservation | BOOKED → CANCELLED, with transactional audit and capacity release. Repeated cancellation returns the same cancelled record. |

Party size is an integer 1–50; table and shift limits may be smaller. Dates and UTC timestamps are validated, with service date range 2000–2099. Name/email are trimmed and reject controls; lengths are bounded at 120/254 Unicode characters. Required email uses a minimal syntax check, not delivery verification. Configuration is migration-owner/fixture managed and runtime read-only. Date-specific, non-overnight shifts use local opening/closing minutes, elapsed duration 15–480 minutes and slot step 5–120 minutes. Table combination, pacing, recurring schedules, full settings editors and graphical floorplans are excluded.

The six physical tables are `reservation_venue_settings`, `reservation_tables`, `reservation_shifts`, `reservation_clients`, `reservations`, and `reservation_changes`. The entity registry cross-references existing stable IDs without changing reference confidence. Organization-owned client IDs contain no contact details; the reservation holds its Venue-scoped contact snapshot. No automatic guest matching or deduplication is inferred.

## Correctness

PostgreSQL's `reservation_no_overlap` GiST exclusion constraint rejects overlapping active allocations for the same table, even across separate runtime connections. Intervals are half-open `[start,end)`, so adjacent bookings are allowed. Configuration rows are share-locked and the write trigger rechecks eligibility. A failed reservation or audit write rolls back the client, reservation and key together.

An advisory transaction lock serializes a command key. A unique Organization/Venue/actor/key constraint and normalized payload fingerprint ensure retries return the same record, including after cancellation; changed payloads return IDEMPOTENCY_CONFLICT. Different keys still compete for capacity at the database constraint. Keys persist for the record's lifetime; there is no TTL reuse or automatic unbounded retry.

Stable domain errors are INVALID_INPUT, ACCESS_DENIED, NOT_FOUND, CAPACITY_CONFLICT, IDEMPOTENCY_CONFLICT and INTERNAL. Database details and guest data are not logged or exposed in these errors. No generic export audit subsystem was added; successful CREATED/CANCELLED metadata is recorded by a restricted trigger path in the same transaction. Durable denied-attempt audit is outside this local slice.

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

Run the whole focused suite without `-t DEMONSTRATION`, then `pnpm verify:db` and `pnpm verify`. Database suites must not reset the same schema concurrently. CI already invokes the full database runner, which now includes this focused suite. CHK-081 records actual results and environment identity.

This is an internal domain demonstration. Public booking, modification, check-in/seating, confirmation delivery, browser integration and live staff-provider verification remain outside this package. CORE-READY-01 remains unmet.
