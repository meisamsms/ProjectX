# PEOPLE-07A — Booked By Names backend

Status: implemented locally, NOT VERIFIED; exact-SHA publication approval and
final branch-head PostgreSQL 16 CI are required. ADR-0011 owns these decisions.

## PROJECTX IMPLEMENTATION DECISION

`booked_by_names` contains UUIDv7 id, organization_id, venue_id, display_name,
integer version, created_at and updated_at. Its composite venue FK prevents an
organization/venue mismatch. There is no User, AuthenticatedIdentity,
OrganizationMembership, VenueAccess, employee or Server Names ownership/link FK.
Adding a display record creates no account, provisioning record or grants.

The separate, scoped `booked_by_name_changes` history stores only successful
create/update ownership, object id, version, action, actor attribution, timestamp
and server-generated request correlation UUID. It stores no name payload. A
fixed-search-path, schema-qualified definer trigger writes it atomically; audit
failure rolls back the state and version. Runtime has no audit read/write rights.
This is not a generic audit subsystem, denied-attempt log, retention policy or UI.

Names are plain text, trimmed using ECMAScript whitespace, preserve case and
internal whitespace, and contain 1–120 Unicode code points. C0/C1 controls and
unpaired surrogates are rejected. The HTTP input budget is 1,024 code points;
the database independently normalizes and bounds stored names. HTML-looking text
is data, not markup; clients must render text safely. No normalization/folding or
global/venue name uniqueness is imposed. Identical and case-variant names may
coexist, including across organizations. A repeated POST is another add, not an
idempotent replay; no hidden identity/duplicate resolution is implemented.

## API and authority

All routes use the existing server-only resolver seam. Without injected trusted
identity/organization/venue and a restricted runtime pool they return 401. This
task does not implement OIDC/session bootstrap. Browser tenant fields, arbitrary
query context and coercible non-string names are rejected, not trusted. Every
operation runs through PEOPLE-02 with canonical `venue.manage`; active actor,
membership, venue access and current effective role/direct permission are
rechecked by authorization and RLS. `user.manage` or `venue.read` alone is not
sufficient. The runtime is non-owner/non-bypass; no predecessor privileges change.

- GET `/api/v1/people/booked-by-names`: `{items:[{id,displayName,version}],nextCursor}`.
  Current authorized venue only; UUID ascending; default limit 25, maximum 100;
  optional UUID cursor is an ordering boundary, not an object-existence lookup.
- POST the same route with `{displayName}`: 201 `{id,displayName,version:1}`.
  Tenant keys and id are server-derived; state/history are one transaction.
- PATCH `/api/v1/people/booked-by-names/{id}` with `{displayName,version}`:
  200 updated DTO. Conditional update increments version atomically. Maximum
  input version 2,147,483,646; no stale last-write-wins. One record per save, no
  batch/partial-save, delete/archive or other lifecycle command.

Safe ApiError envelopes: 400 invalid input, 401 unbound identity, 403 missing
current capability, 404 missing or foreign record in an authorized scope, 409
stale version (not duplicate name), 500 generic failure. No SQL/constraint/stack,
foreign tenant, role/grant, identity or audit metadata is returned. Generated
OpenAPI DTOs and schemas are the request/response source of truth.

## Migration and verification

Forward-only `people-zz-booked-by/20261002000700_people_booked_by.sql` sorts after
all six historical migrations in the existing directory-sorted runner. Historical
SQL is unchanged. Clean install, six-migration upgrade with row/checksum
preservation, repeat and ledger drift are covered in the focused database suite.
Three predecessor ledger expectation arrays append this migration; their original
checksums, physical privilege checks and behavioral assertions remain intact.

`booked-by.test.ts` uses synthetic fixtures and a non-owner PostgreSQL login, not
an in-memory substitute. Coverage includes persistence, Unicode/control/empty/
length validation, duplicate policy, pagination, composite ownership, foreign IDs,
revocation/disabled actor, raw RLS, wrong parent, immutable ownership/version,
atomic history rollback, minimal API DTOs, safe errors and migrations. The database
runner retains all predecessor suites. `booked-by-contract.test.ts` independently
checks HTTP input and unauthenticated contracts; it proves no database behavior.
Both required repository gates must pass on PostgreSQL 16 CI before VERIFIED.

## SevenRooms reference track

Only SCR-083 name rows and ACT-0167 Add new name / ACT-0168 Save changes are
documented observations. U-001/U-002/U-003 and every reference UNKNOWN / NEEDS
TESTING remain untouched. Persistence, duplicate handling, normalization, ordering,
maximum/minimum length, whitespace, case, save/partial-save, delete/archive,
concurrency, audit, User/employee/server relationships and success/failure
messages remain unknown. These decisions do not assert reference internals.
PEOPLE-07B/08A/08B/09/09B/10, identity linking, MFA, subscriptions, delivery,
Export, other settings and main are outside this task.
