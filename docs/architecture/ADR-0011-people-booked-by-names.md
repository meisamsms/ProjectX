# ADR-0011: Venue-scoped Booked By Names

Status: accepted for PEOPLE-07A implementation; PostgreSQL 16 CI pending.

## PROJECTX IMPLEMENTATION DECISION

SCR-083 evidence supports visible name rows, Add new name (ACT-0167) and Save
changes (ACT-0168), not reference persistence or validation semantics.

Booked By Names are independent display records owned by an organization and a
venue, with a composite venue foreign key. They are not Users, authenticated
identities, memberships, employees or Server Names. There is no identity FK.

Names are trimmed, case-preserving plain text, 1–120 Unicode code points after
trimming, without C0/C1 controls. Duplicate names are allowed within and across
venues and organizations: neither discovery nor the roadmap establishes a strong
uniqueness need. No delete/archive operation is introduced. Lists use ascending
UUID with bounded cursor pagination, consistent with the existing People roster.
Updates require the current integer version and return 409 for stale versions;
each save updates one record, not a batch or partial-save workflow.

Every operation requires the canonical venue.manage capability in a trusted
server-bound organization/venue context, through the PEOPLE-02 transaction and
restricted runtime role. RLS rechecks current membership, actor and venue access.
Known foreign IDs and missing IDs both return 404 within an authorized scope.

The existing transaction-boundary requirements call for atomic state and audit
metadata. A narrow append-only booked_by_name_changes table records successful
create/update actor attribution, ownership, version, action, time and server
request correlation ID, via a
fixed-search-path trigger in the same transaction. It contains no name payload
and has no runtime read/write grants or public API. Attribution is not identity
ownership and has no User FK. This does not implement the future generic audit
subsystem, denied-attempt auditing, retention or an audit UI.

## Required integration dependencies

The database runner must include the new focused suite; the integration script
must also run the database-independent HTTP input tests. The existing RLS,
roster-fields and direct-grants migration suites compare the complete ledger;
append the new migration to those expectations without changing predecessor
migrations, checksums, privilege assertions or functional tests.

## Reference track

All SevenRooms UNKNOWN / NEEDS TESTING classifications, including U-001, U-002
and U-003, remain unchanged. Persistence, duplicates, normalization, ordering,
length, whitespace, case, save/partial-save, delete/archive, concurrency, audit,
User/employee/server relationships and success/failure messages remain unknown.
These ProjectX choices are not evidence of SevenRooms internals.
