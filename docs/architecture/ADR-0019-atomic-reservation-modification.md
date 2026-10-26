# ADR-0019 — Atomic internal reservation modification

Status: ACCEPTED; owner explicitly approved this precise database boundary after
the automatic approval-review interruption. Implementation and verification proceed.
Owner's DOMAIN-002 package otherwise authorizes specification, implementation,
tests, demonstration, documentation and one local commit, without a push.

## Decision

Extend ADR-0018 using the existing trusted identity transaction and restricted
PostgreSQL runtime. Add revision (initially 1); each successful modification and
first cancellation advances it. Repeated cancellation remains idempotent.
Only BOOKED reservations may be modified. Inputs replace date/start/table/shift/
party allocation, with expectedRevision and a separate modification key.
Same-allocation commands still advance revision and record one audit entry.

Keep direct runtime column UPDATE grants cancellation-only. A narrow SECURITY
DEFINER database function checks current read/update capabilities and tenant/Venue
context, locks the reservation, validates expected revision and slot, and changes
allocation. Fixed trusted search_path and no PUBLIC execution are mandatory.
No runtime role, framework or authentication change.

An immutable RLS command table serves as modification audit and result ledger.
Runtime cannot directly insert, read, update or delete it. The function records
actor, scoped key, normalized typed request and before/after allocation including
revision, status and timestamp, without duplicating guest PII. The reservation
trigger accepts BOOKED updates only with exact matching protected command evidence
and independently validates configuration/capacity. Command, allocation and audit
commit together. Existing CREATED/CANCELLED audit immutability remains unchanged.

## Ordering and results

1. Validate input/current permissions; lock the scoped modification key.
2. Lock the scoped reservation; inaccessible IDs return NOT_FOUND.
3. Matching stored key/request returns the original result snapshot before checking
   current status/revision. Changed payload returns IDEMPOTENCY_CONFLICT. Replay
   requires current access. Its revision/status describe the historical result;
   getReservation reads current state. Immutable guest identity is not duplicated.
4. New commands reject non-BOOKED with INVALID_STATE and stale revision with
   VERSION_CONFLICT. Derive end/timezone from the validated slot; write protected
   command evidence and update. PostgreSQL exclusion remains the final arbiter.
5. Same-reservation races serialize, with one revision winner. Capacity competition
   has at most one winner. Cancellation either follows modification or causes it
   to reject CANCELLED. No resurrection. Allocation deadlock returns a safe
   CAPACITY_CONFLICT with full rollback; no automatic retries.

Keys are organization/Venue/actor scoped within modification, separate from create
keys and retained for record lifetime. Failed commands consume no key or revision.
Timezone/DST slot rules, guest identity/contact and tenant ownership stay unchanged.

## Required evidence

Focused PostgreSQL16 tests: successful time/table/party/date changes; invalid slots;
stale/replayed commands; same-row/capacity/cancel races; tenant/revocation/permission/
raw SQL denials; audit failure rollback; DST; and create/modify/read/cancel demo.
Run db:check, focused tests, verify:db, verify, map:check and git diff --check.
DOMAIN-002-REGRESSION-001 owns five additive ledger inventory corrections and
DOMAIN-001 schema replay support without weakening historical assertions.
Whole-product readiness remains unmet and all existing public/auth gates remain.

## Approval interruption

Automatic approval review rejected the proposed SQL/ADR patch: persistent schema,
RLS, trigger, grant and SECURITY DEFINER changes required clearer authorization
for the exact implementation. The owner was asked to approve this database boundary.
At that interruption no rejected migration/application patch was applied and no
feature tests had run. The subsequent explicit approval permitted implementation.

Resolution: Owner replied “Approve this bounded implementation” to the exact
database-boundary approval request. No authentication or public-access gate waived.

## Verified outcome

CHK-082: focused50/50, database260/260 across22 files, general verify289/289
application/browser tests and API/web builds PASS on PostgreSQL16.15. Includes
persisted DOMAIN-001 upgrade preservation and deterministic real lock-order races.
One local commit; no push and no whole-product readiness claim.
