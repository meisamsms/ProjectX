# PEOPLE-08A: Server Names backend

Local implementation only; final exact-SHA PostgreSQL 16 CI is required.
All behavior below is a **PROJECTX IMPLEMENTATION DECISION**, not SevenRooms parity.

## Reference evidence boundary

SCR-084 `/manager/oceansatarthurs/manage/servernames/edit`, Settings > People:
CMP-0702 Server name rows, CMP-0703 Name, ACT-0169 Add new name and ACT-0170 Save
changes are the only confirmed visible evidence. No reference actions were run and
no new SevenRooms evidence was created. Alternate-role behavior NEEDS TESTING.
U-001/U-002/U-003 and all existing reference classifications are unchanged.

Reference persistence, required/optional semantics, validation, length, whitespace,
case, duplicates/uniqueness, sorting/pagination/ordering, add/save outcomes,
single/batch/partial save, errors/messages/conflicts/concurrency, delete/archive,
audit, User/employee/authenticated-identity/Booked By relationships, alternate
roles, loading/error/disabled states, notifications and success messages remain
UNKNOWN / NEEDS TESTING. ProjectX choices do not resolve any of these unknowns.

## Domain and persistence

`Organization -> Venue -> server_names`, composite `(organization_id, venue_id)`
FK to Venue with RESTRICT; UUIDv7 record id. Columns: id, organization_id, venue_id,
display_name, positive integer version, created_at and updated_at. No name
uniqueness: duplicate display text is allowed within/across venues/organizations.
No account, identity, membership, employee, OIDC or provisioning linkage. Separate
from Booked By storage, history and endpoints; no synchronization or equivalence.

Name rules: plain text, case-preserving ECMAScript edge trim, 1–120 Unicode code
points after trim, C0/C1 controls and unpaired surrogates rejected. Raw input budget
1024 code points. Database trigger also enforces normalized bounded valid text;
PostgreSQL UTF-8 rejects surrogate code points. No HTML interpretation is provided.

Version starts at 1. Atomic conditional update requires the loaded version and
increments once. Stale current-scope record: safe 409; missing/foreign record: same
safe 404. Failed validation/conflict/audit writes roll back without partial save.
No delete/archive/restore or bulk operations.

## API and authority

- GET `/api/v1/people/server-names`: optional limit 1–100 (default 25) and UUID
  cursor; UUID ascending keyset order. `{items: [{id,displayName,version}],
  nextCursor: string|null}`. No tenant/audit metadata in DTOs.
- POST same path: `{displayName}` -> 201 minimal record.
- PATCH `/{id}`: `{displayName,version}` -> 200 updated minimal record.
- Generated OpenAPI request/response types are authoritative. Strict fields,
  numeric version, UUID path/cursor; duplicate/unknown queries rejected. Safe
  ApiError categories 400/401/403/404/409/500; no SQL, policy, identity or tenant
  internals returned.

Existing registry `venue.manage` covers explicitly authorized venue settings.
Trusted identity and selected organization/venue come only from the server
resolver, never browser authority. Unchanged PEOPLE-02 transactions check active
User, membership, VenueAccess, scope and current canonical capability. Runtime is
non-owner/non-superuser/non-BYPASSRLS. SELECT/INSERT/UPDATE RLS independently checks
organization/venue and current authority; runtime can update only name/version.

Separate append-only `server_name_changes`: tenant, record/version, CREATED/UPDATED,
actor UUID (no User FK), request UUID, time. Atomic fixed-search-path definer trigger
records successful mutations only. Runtime has no history read/write or DELETE.
No generic audit subsystem and no display-name payload in history.

## Migration and verification

ADR-0013 documents the narrow app/contract/test-harness dependencies.
`people-zzz-server-names/20261003000800_people_server_names.sql` appends eighth in
the existing directory-sorted runner. Seven historical migration SQL files remain
unchanged. Existing exact-ledger expectations append this migration; the Booked By
checksum assertion targets its own migration rather than the ledger's last row.

Focused real PostgreSQL tests cover create/list/update, atomic audit/rollback,
ownership/catalog metadata, no identity linkage, Unicode/validation/duplicates,
pagination, concurrency, active/revoked/disabled/missing-capability actors, foreign
scope/IDs, raw runtime RLS, privileges, independent Booked By mutations, clean/
seven-migration upgrade preserving Booked By rows/history, repeat/checksum checks.
Database-independent contract tests validate strict HTTP and safe failure shapes
only; they are not database or RLS evidence. Local results and limitations are
recorded in verification.json and handoff.md. PEOPLE-08A remains BLOCKED before
approved publication and successful final PostgreSQL 16 CI; PEOPLE-08B is PLANNED.
