# ADR-0020 — Internal check-in and seating

Status: ACCEPTED (ProjectX implementation decision, verified by CHK-084). Owner
approved both narrow compatibility exceptions (`RESERVATION-DOMAIN-003-REGRESSION-001`
for schema-replay and complete-ledger test inventories, and
`RESERVATION-DOMAIN-003-REGRESSION-002` Option B aligning the 24-entry permission
catalog across the database migration, `docs/security/permission-registry.json`,
OpenAPI `PeoplePermissionId`, generated contract types, the Add User request
schema, and the two affected permission-count assertions). This is ProjectX
design, not SevenRooms evidence. No public/staff HTTP or UI.

## Bounded transition contract

| Operation | Required current state | Result | Required current permissions |
| --- | --- | --- | --- |
| checkInReservation | BOOKED | CHECKED_IN | reservation.read + reservation.checkin |
| seatReservation | CHECKED_IN | SEATED | reservation.read + reservation.seat |
| modifyReservation | BOOKED | BOOKED | Existing read + update |
| cancelReservation | BOOKED | CANCELLED | Existing read + cancel |

No skipped check-in, reversal, reactivation, checkout, no-show or completion.
Repeated cancellation of CANCELLED retains existing behavior. Cancellation of
CHECKED_IN/SEATED returns INVALID_STATE, rather than misleadingly returning the
unchanged active row as a successful cancellation. New lifecycle commands reject
invalid states and stale revisions. Identity, guest/contact and allocation stay
immutable. No new wall-clock arrival-window restriction is inferred.

## Proposed database boundary

Add only the missing Venue-scoped reservation.checkin and reservation.seat
permission definitions; neither implies update/cancel. Do not auto-grant them.
Reuse trusted identity, current VenueAccess, read permission and restricted pool.
A narrowly scoped SECURITY DEFINER transition function with fixed trusted search
path and revoked PUBLIC execution checks scope/permission, locks command key then
reservation, and rechecks access after waiting. Existing direct runtime column
UPDATE grants and cancellation RLS remain narrow. Database triggers validate the
state transition, immutable fields, next revision and protected command evidence.

Reuse reservation_modifications as the existing immutable command/audit ledger;
retain its historical name and avoid a parallel table/mechanism. Lifecycle payload
includes operation/state, reservation ID and expected revision. Modification and
lifecycle share its organization/Venue/actor/key namespace and existing advisory
key-lock convention. Same key/payload replays the original result snapshot even
after a later state; changed payload or operation conflicts. Replays still require
current operation permissions. No automatic retries. Failed commands consume no
key/revision. Snapshot status/revision/timestamp describes that original result;
get/list returns current state.

The ledger already stores actor, reservation/tenant/Venue, before/after status,
revision, timestamp and command identity without guest PII. State write and audit
must commit together. Existing audit immutability and composite ownership remain.

An additive migration expands the status constraint and recreates the existing
exclusion constraint transactionally for BOOKED, CHECKED_IN and SEATED. Search
also treats all three as capacity-holding states. Existing allocation intervals
and timezone/DST rules do not change. Lifecycle transitions never free capacity;
this is reservation allocation, not physical occupancy tracking.

## Approved compatibility exceptions

The initial owner request stated: "Run all existing DOMAIN-001/002 tests unchanged."
Two narrow compatibility exceptions were identified during preflight (`CHK-083`)
and explicitly approved by the owner before implementation:

1. `RESERVATION-DOMAIN-003-REGRESSION-001`: Two tests in `apps/api/tests/reservations/domain.test.ts`
   explicitly drop/rebuild the reservation schema while clearing earlier migration
   ledger entries (`migration is replay-safe and clean/upgrade produce the same reservation schema`
   and `upgrade from persisted DOMAIN-001 retains bookings, clients, audit, checksums and least privileges`).
   Including `zz-reservation-domain/20261026001200_reservation_lifecycle.sql` in
   those replay-ledger setups and appending it to the five complete-ledger People
   migration inventory tests preserves all 50 existing reservation behavioral tests
   and all checksum, privilege, RLS and schema-equivalence assertions without
   altering historical SQL or the migration runner.
2. `RESERVATION-DOMAIN-003-REGRESSION-002` (Option B): Adding `reservation.checkin`
   and `reservation.seat` (`VENUE`, `SENSITIVE`, `MOD-02`) to `permissions`
   increases the canonical permission catalog from 22 to 24 entries. The owner
   approved aligning `docs/security/permission-registry.json`, `packages/contracts/openapi.json`
   (`PeoplePermissionId` enum and `maxItems: 24`), `packages/contracts/generated/api.ts`,
   `apps/api/src/people/add-user/schema.ts`, and the affected 22 -> 24 count
   assertions in `apps/api/tests/people/grants.test.ts` and
   `apps/api/tests/people/grants-migrations.test.ts`, without granting the new
   permissions to any existing role or user or exposing new reservation HTTP endpoints.

## Verification summary (CHK-084)

Focused lifecycle tests (`apps/api/tests/reservations/domain.test.ts`, 62/62 total:
26 DOMAIN-001 + 24 DOMAIN-002 + 12 DOMAIN-003) and full database verification
(`pnpm verify:db`, 272/272 across 22 files on disposable PostgreSQL 16.15) verify
persisted DOMAIN-002 upgrade equivalence, valid/invalid state transitions,
separate permissions (`reservation.checkin` and `reservation.seat` independent of
`reservation.update` and `reservation.cancel`), tenant/RLS/raw SQL denials,
idempotent replay/conflict across operations, stale revisions, competing
check-in/seating, both lock orders against cancellation and modification,
permission revocation while waiting on a row lock, audit rollback/immutability,
active-state capacity retention across `BOOKED`, `CHECKED_IN` and `SEATED`, and
the synthetic PostgreSQL 16 lifecycle demonstration.
