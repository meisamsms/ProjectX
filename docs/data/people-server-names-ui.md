# PEOPLE-08B: Server Names frontend

All behavior here is a PROJECTX IMPLEMENTATION DECISION, not SevenRooms parity.
Only SCR-084 visible Server name rows, Name, Add new name and Save changes are
confirmed reference evidence. All reference UNKNOWN / NEEDS TESTING classifications
and U-001/U-002/U-003 are unchanged. No live reference data/actions were used.

## Scope and contract

Independent page/client at /manager/oceansatarthurs/manage/servernames/edit.
Generated listServerNames/addServerName/updateServerName operation types are used
directly. GET carries limit 25 and optional returned cursor. POST carries only
displayName; PATCH only displayName and current version. IDs/versions are internal,
not visible. Backend venue.manage, trusted selected Venue and RLS are authoritative.
No browser role/permission inference or organization/venue authority selectors.
No User, AuthenticatedIdentity, employee, email, Booked By record/state/endpoint
sharing, synchronization, delete/archive or Export.

## Editor policy

Loading, loaded, empty, safe denied/sign-in/generic failure and operation statuses
are distinct. Preserve backend list order. Load more appends, deduplicates by ID and
never replaces existing saved versions, row drafts or a new local draft.
Confirmed creates are inserted by UUID order, not display text.

Add opens a focused local draft without POST; Cancel discards only that draft.
Create and independent per-row Save await returned record/name/version, clear the
successful draft and announce success. Never fabricate persisted IDs or success.
One operation lock prevents repeated/pending submissions. Duplicate display names
are allowed and rows have distinct accessible names. Normalize dirty comparison
and submit with ECMAScript edge trim, preserve case; validate 1–120 Unicode code
points, 1024 raw input budget, no controls/unpaired surrogates. No incompatible
UTF-16 HTML maxlength; backend remains authoritative.

Status-derived 400/401/403/404/409/5xx alerts exclude raw SQL, constraints, RLS,
tenant/identity/debug metadata. Errors retain draft text and focus the alert after
render. 409 blocks another save until explicit refresh; never retry/overwrite.
404 uses safe unavailable language, not a deletion or foreign-existence claim.
Refresh with any draft requests explicit discard confirmation; Keep editing makes
no GET. Drafts are cleared only after a successful confirmed refresh. Failed
refresh retains both old and new edits. No global navigation guard exists, so the
page visibly warns navigation/reload loses drafts; no new unload subsystem.

## Verification and reference boundary

Synthetic component/client and browser tests cover pagination, local drafts,
confirmed create/save/version behavior, duplicates/Unicode, errors/conflicts/
refresh, unique labels, keyboard, actual asynchronous focus, axe and responsive
layout. They verify ProjectX only. Reference persistence, validation, duplicates,
whitespace/case, order/pagination, save/partial-save/outcomes, concurrency,
lifecycle/delete/archive, identity/employee/Booked By relationships, alternate
roles, loading/error/disabled/messages and navigation remain UNKNOWN / NEEDS TESTING.
ADR-0014 records narrow shell/styles/route-validator/test-runner dependencies.
Final branch-head PostgreSQL 16 CI is required before PEOPLE-08B becomes VERIFIED.
