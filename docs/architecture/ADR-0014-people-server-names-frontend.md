# ADR-0014: Server Names frontend

Status: accepted for PEOPLE-08B local implementation; publication/final CI pending.

## PROJECTX IMPLEMENTATION DECISION

SCR-084 confirms only visible Server name rows, Name, Add new name (ACT-0169)
and Save changes (ACT-0170). Every frontend choice below is independent ProjectX
behavior, not reference parity. No live reference writes or new evidence.

Consume unchanged generated listServerNames/addServerName/updateServerName
operations through an independent client/page. No Booked By state, endpoint,
record sharing, synchronization, User/employee/AuthIdentity linkage or lifecycle
actions. Server-bound venue scope and venue.manage remain backend authoritative;
send only cursor/limit, displayName and update version, never tenant authority.

Add opens/focuses one local draft; Cancel discards it without POST. Explicit Create
and per-record Save wait for confirmed returned ID/name/version. Case-preserving
edge trim, 1–120 Unicode code points, control/surrogate rejection and duplicates
follow PEOPLE-08A. No HTML UTF-16 maxlength. Compare trimmed text for dirty state.
Use backend order, cursor Load more, append and ID-deduplicate without overwriting
existing drafts or confirmed versions. Insert newly confirmed records by UUID
order, never by name. Lock outstanding operations; no automatic write retry.

Safe status-derived alerts never render raw metadata. Preserve drafts on failure.
409/404 block another save until explicit refresh; do not infer deletion or foreign
existence. Refresh with any local draft requires discard confirmation and clears
drafts only after successful GET. Keep editing cancels without requesting data.
The existing router has no global navigation guard: visibly warn that navigation/
reload loses drafts, and add no beforeunload subsystem. Use passive-effect focus
with waitFor/auto-retrying browser assertions, status announcements, contextual
labels, keyboard controls, scoped responsive styles and synthetic axe tests.

## Narrow integration dependencies

Register only SCR-084 in the existing shell and responsive main width. Append
Server Names-only styles, advance only SCR-084 route status after focused tests,
extend validate-map's existing screen allowlist by SCR-084, and append its component
file to test:web for repository CI. These are required PEOPLE-08B harness seams,
not implementations of other tasks. Existing screens/backends/contracts/migrations
and RLS remain unchanged; PEOPLE-08A is the verified prerequisite.

## Reference and verification boundary

Preserve all U-001/U-002/U-003 and UNKNOWN / NEEDS TESTING classifications for
persistence, validation, duplicates, whitespace/case, ordering/pagination, save/
partial-save/outcome/concurrency, lifecycle/delete/archive, identity/employee/
Booked By relationships, alternate roles, loading/error/disabled/messages and
navigation. Synthetic tests establish only ProjectX behavior.
PEOPLE-08B stays BLOCKED after local verification until exact-SHA approval,
publication and final branch-head pnpm verify and pnpm verify:db on PostgreSQL 16.
No next task starts.
