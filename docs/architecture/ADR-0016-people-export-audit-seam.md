# ADR-0016: Export-only durable audit write seam

Status: accepted architecture decision only, 2026-10-04. PEOPLE-D010 APPROVED,
OWNER APPROVED / PROJECTX IMPLEMENTATION DECISION. Option A — narrow export-only
writer inside PEOPLE-09. No export/audit implementation or runtime verification.

## Context and resolution

PEOPLE-09-AUDIT-001 recorded a missing reusable export attempt/result writer.
Booked By and Server Names histories accept only successful CREATED/UPDATED
name-record/version events through venue.manage mutation triggers. They cannot be
repurposed for export. PEOPLE-02 rejects capability denial before its callback and
rolls back failures, so recording denied/failed events in that failed work cannot
provide durability. The historical blocker is valid and remains preserved; it
never claimed a safe new export-only writer was impossible.

The owner approves Option A within PEOPLE-09: an export-only append-only persistence
structure, tightly scoped writer and PEOPLE-09-specific trusted-scope transaction
seam that can durably record success/denied/failed. This resolves the architecture
approval prerequisite, not implementation/tests. PEOPLE-D009's CSV business contract
and existing PEOPLE-02/03 behavior remain unchanged. No new generic Audit module,
cross-module framework, roadmap parent or unrelated mutation/history coupling.

## Minimal persistence and privilege contract

Conceptual minimum fields: `id`, `organization_id`, `venue_id`, `actor_user_id`,
`request_id`, `event_type`, `result`, `exported_row_count`, `occurred_at`.
Fixed event `people.accounts.export`; result only `success`, `denied`, `failed`.
Row count is nullable and allowed only on success; success includes its actual
exported count, including zero. Row identity/request correlation are explicitly
approved persistence metadata, not CSV fields or permission to store content.

No CSV bytes, Name/Job Title/Access Level/Email Notifications values, filename,
stack trace, SQL, arbitrary failure payload, metadata JSON or generated-file
reference. No file/job/downloadable artifact retention is introduced.

Rows are append-only with the repository-consistent immutability mechanism.
Normal runtime has no direct INSERT/UPDATE/DELETE on audit rows. Use a narrow
SECURITY DEFINER writer with fixed safe search_path, explicit validation, EXECUTE
only for projectx_people_runtime, no PUBLIC EXECUTE, no generic SQL/table/event
selection. The runtime role stays restricted: no BYPASSRLS or request-time
admin/migration-owner connection, arbitrary privileged writes or broad audit SELECT.
Any runtime audit readability needs a separate explicit authorization decision;
PEOPLE-09 exposes no audit-read API.

## Trusted attribution and referential validation

The trusted server resolver establishes verified actor, Organization, Venue and
request ID; derive or validate writer context against that server-established
request/transaction context. Unavoidable function parameters must match trusted
context and referential ownership. Browser DTOs/tenant IDs are not authority, and
custom PostgreSQL settings alone are not identity proof: retain the existing
server verification, parameterization and narrow-grant boundaries.

Validate User and Organization existence, Venue existence and Venue ownership by
that Organization using existing composite ownership conventions. Existing
name-change histories intentionally store actor UUID attribution without a User
ownership FK. If following that pattern, explicitly validate User existence in
the export writer as the safe alternative and document physical constraints in
implementation; do not infer new deletion/retention/lifecycle semantics. Actor
attribution is not employee identity or Booked By/Server Names ownership. No
arbitrary actor impersonation, cross-tenant audit injection or visibility widening.
Never fabricate an actor/scope when trusted context is absent.

## Result durability and CSV atomicity

Denial: trusted attribution/scope is established before export capability
evaluation. A narrow writer can durably record denial without requiring
people.accounts.export merely to audit it, while validating attribution/ownership
to prevent injection. Audit permission never authorizes roster access; no export
query runs after denial. This does not relax disabled/revoked export denial.

Failure: roll back the authorized export work, safely classify failure, then
persist a separate bounded failed audit through the export-only seam where
required. No failure internals, partial CSV, unbounded recovery/retry, or resurrection
or commit of failed work. Separate denial/failure durability from the rolled-back
transaction instead of altering global PEOPLE-02 transaction semantics.

Success: generate the complete bounded CSV and persist the required success audit
with row count before returning successful CSV. Audit failure must fail export;
no successful or partial CSV without required audit. No CSV values stored. This
implements PEOPLE-D009's failure-atomicity intent; server success does not prove
client receipt. Implementation must preserve safe errors if secondary failure
auditing itself cannot persist; it must not falsely claim audit durability.

## Future implementation and verification gates

Only PEOPLE-09 may implement a forward-only migration, export-specific audit table
and writer, tightly scoped helper and focused PostgreSQL security tests. Do not
edit historical migrations or weaken existing RLS/read/grant semantics. Tests must
prove fixed event/result/count constraints, immutable rows/no direct runtime DML,
no PUBLIC execute, safe search_path, trusted attribution/referential ownership,
cross-tenant/actor/request/event rejection, no data query after denial, independent
denied/failed durability, rollback preservation, no content storage/read exposure,
and required success audit before response including audit-failure atomicity.

PEOPLE-09 becomes READY, not implemented/VERIFIED. PEOPLE-03 is its VERIFIED
prerequisite. PEOPLE-09B/10 remain PLANNED; IMPL-MOD-14 IN_PROGRESS. After future
implementation, separate exact-SHA publication approval and final branch-head
pnpm verify plus pnpm verify:db on PostgreSQL 16 remain required before VERIFIED.

## SevenRooms boundary

ACT-0056 remains CONFIRMED visible Export action only. Format, fields, tenant scope,
filters, permissions, delivery, filename, audit, retention, cancellation/failure
and alternate-role behavior remain UNKNOWN / NEEDS TESTING. U-001/U-002/U-003 and
all other reference classifications unchanged. PEOPLE-D010 is not new reference
evidence or a parity claim. No live reference interaction or implementation here.
