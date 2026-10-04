# ADR-0013: Independent venue-scoped Server Names backend

Status: accepted PROJECTX IMPLEMENTATION DECISION; PEOPLE-08A verification pending.

## Evidence and boundary

SCR-084 shows Server name rows, Name, Add new name (ACT-0169), and Save changes
(ACT-0170). Nothing establishes its persistence, validation, identity relationships,
save semantics, authorization, or other hidden reference behavior. U-001/U-002/U-003
and all existing UNKNOWN / NEEDS TESTING classifications remain unchanged.

## Decision

Every choice below is a PROJECTX IMPLEMENTATION DECISION, not SevenRooms parity.

- Separate `server_names` table: UUIDv7 id, organization_id, venue_id, display_name,
  version, created_at, updated_at. Composite Venue ownership uses RESTRICT.
- No User, AuthenticatedIdentity, employee, membership, OIDC, provisioning, or
  Booked By relationship; no shared table, discriminator, synchronization or FK.
- Trim ECMAScript edge whitespace; preserve case and plain text. Require 1–120
  Unicode code points, reject C0/C1 controls and unpaired surrogates; input budget
  1024 code points. Duplicates are allowed within/across venues and organizations.
- UUID ascending keyset pagination, default 25, maximum 100; list/add/single-record
  PATCH only. PATCH requires current version, increments atomically, stale 409,
  scoped unavailable 404. No delete/archive/restore/bulk operations.
- Existing canonical `venue.manage` means explicitly authorized venue settings;
  server-bound trusted identity/context, active actor/membership/access and current
  capability are checked through unchanged PEOPLE-02 authorized transactions.
  Restricted non-owner/non-BYPASSRLS runtime and RLS independently enforce scope.
- Separate append-only `server_name_changes` records successful create/update
  version, action, actor UUID, request UUID and tenant/time metadata atomically.
  Fixed-search-path definer trigger follows PEOPLE-07A; no audit name payload or
  User FK; runtime cannot read/mutate history or change record ownership.
- Minimal generated OpenAPI DTOs; safe 400/401/403/404/409/500 error categories.

## Narrow integration dependencies

The existing migration runner sorts directory/file paths lexicographically.
`people-zzz-server-names/20261003000800_people_server_names.sql` appends after all
seven verified migrations; the suggested `people-server-names` would not.
Historical SQL and runner behavior are unchanged.

Register the new backend in the shared API app and the two new test files in the
existing integration/database runners. Append the eighth migration to exact-ledger
assertions in PEOPLE-02/03P/04P/07A tests. PEOPLE-07A's checksum assertion must
identify its own migration instead of assuming it is the final migration. These
are harness-only dependencies: all prior assertions and Booked By application,
contract, migration and frontend behavior remain unchanged. No other task starts.

## Verification gate

Focused persistence/API/RLS/tenant/authorization/migration tests use disposable
PostgreSQL, not mocks. Contract-only tests do not establish DB/RLS verification.
Local implementation stays BLOCKED until separate exact-SHA publication approval
and final branch-head `pnpm verify` / `pnpm verify:db` pass on PostgreSQL 16.
PEOPLE-08B remains PLANNED until that prerequisite is VERIFIED.
