# ADR-0012: Booked By Names frontend

Status: accepted for PEOPLE-07B implementation; exact-SHA publication and final CI pending.

## PROJECTX IMPLEMENTATION DECISION

Only SCR-083, Add new name (ACT-0167), Save changes (ACT-0168) and visible
name rows are reference observations. The following choices are independent
ProjectX implementation decisions against the verified PEOPLE-07A contract.

Use generated GET/POST/PATCH operation types, a cursor-based list and one-record
saves. Add opens a local draft; only explicit Create submits. Cancel discards
that new draft locally. Validate trimmed 1–120 Unicode code points, reject
controls/unpaired surrogates, preserve case and allow duplicate display names.
Do not use an HTML UTF-16 maxlength that would reject valid Unicode names.

Retain all drafts on API failure. A 409 blocks another save of that stale row
until an explicit refresh; never silently retry with a new version. A refresh
with drafts requires explicit discard confirmation, and discards only after a
successful GET. Paging deduplicates by ID and does not overwrite existing drafts
or newer saved versions. Successful writes use only returned records/versions.
One outstanding operation prevents duplicate submission. No automatic write
retry, batch persistence, delete/archive, identity, employee or Server Names UI.

The existing BrowserRouter has no navigation guard. Local drafts are lost on
navigation/reload, stated visibly; no global blocker or beforeunload framework is
introduced. Explicit in-page refresh is protected. Server-bound authorization
and venue scope remain authoritative; browser DTOs carry no tenant selectors.
Errors are status-derived safe messages, never raw response metadata. Focus
moves to the new input, cancellation target, success or alert after rendering.

## Required integration dependencies

The shell must render SCR-083 and give it responsive width. Append scoped styles
without altering existing screens. Register only SCR-083 as IMPLEMENTED after
focused tests; extend the map validator's explicit implementation allowlist by
only SCR-083. Add the focused component suite to test:web so repository CI runs
it. These are PEOPLE-07B harness dependencies, not other module implementations.

## Reference track

U-001/U-002/U-003 and all UNKNOWN / NEEDS TESTING classifications remain intact.
Persistence, duplicates, normalization, ordering, length, whitespace, case,
save/partial-save, delete/archive, concurrency, audit, identity/employee/Server
Names relationships, messages and unsaved navigation behavior remain unknown in
SevenRooms. Synthetic local tests create no reference evidence or parity claim.
