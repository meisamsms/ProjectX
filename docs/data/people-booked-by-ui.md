# Booked By Names frontend — PEOPLE-07B

## Reference observations

Existing evidence only: SCR-083 at
`/manager/oceansatarthurs/manage/bookedbynames/edit`, visible name rows,
ACT-0167 Add new name and ACT-0168 Save changes. No reference application writes
or new observations were performed for this implementation.

## PROJECTX IMPLEMENTATION DECISION

ADR-0012 records the independent frontend choices. The editor consumes generated
PEOPLE-07A GET/POST/PATCH operations; no DTO, backend, migration or contract schema
is recreated. `id` is used only for stable keys, deduplication and the PATCH path;
`version` is used only as the server's update precondition. Neither is displayed.

- GET defaults to a bounded 25-record page; Load more passes `nextCursor`, merges
  by ID in UUID order, permits duplicate names and preserves existing rows/drafts
  on overlap. No page numbers, search/sort or fake data.
- Empty results offer Add new name without fabricated rows. Add opens a focused
  local editor; Cancel closes it and returns focus without POST. Explicit Create
  sends only trimmed `displayName`; only the confirmed response adds a row.
- Each existing name has a labeled text input and a dirty/valid-only Save. PATCH
  sends that row's trimmed name and current version. Confirmation applies the
  returned record/version and clears only that row's draft. No batch-save.
- Validation matches the backend's 1–120 trimmed Unicode code points,
  case-preservation and control/unpaired-surrogate rejection. A 1024-code-point
  raw-input limit matches the HTTP validation budget. Duplicate names are valid.
  No UTF-16 HTML maxlength is imposed. The backend remains authoritative.
- One outstanding operation locks write/paging controls against duplicate
  submission. Requests abort on unmount; no automatic POST/PATCH retry or
  optimistic success. Status-derived messages discard raw error bodies.
- 400/401/403/404/409/5xx have safe messages and focus the alert after rendering.
  A 404/409 retains the row draft and blocks further saves until an explicit
  refresh. No silent use of a newer version or overwrite. Success receives focus
  and a status announcement; dirty and validation states are textual, not color-only.
- Refresh with any draft (including an open empty new editor) requires an
  explicit discard confirmation. Keep editing restores focus to Refresh. The
  discard happens only after successful GET; failure preserves all drafts.
  There is no established global navigation guard. Navigation/reload loses local
  drafts, stated visibly; no global router or browser-unload framework is added.
- All scope and `venue.manage` authority come from authenticated server context
  and verified RLS. The client supplies no organization/venue/actor/role selectors,
  identity credentials, issuer/subject, sessions or secrets. Visibility is not an
  authorization mechanism. Display labels are not Users, employees or Server Names.
- No delete/archive, lifecycle controls, Server Names linkage or other People
  feature. SCR-083 alone advances the route implementation marker; discovery and
  verification classifications remain separate from local route implementation.

## Reference unknowns preserved

U-001/U-002/U-003 and every SevenRooms UNKNOWN / NEEDS TESTING classification
are unchanged. Persistence, duplicates, normalization, ordering, minimum/maximum
length, whitespace, case sensitivity, save/partial-save behavior, delete/archive,
concurrency, audit, identity/employee/Server Names relationships, success/failure
messages and unsaved navigation remain unknown. These ProjectX choices are not
evidence about SevenRooms internals or parity.

## Verification boundary

Synthetic component and browser fixtures only. Component tests cover list,
paging, creation, one-record saves, Unicode validation, authorization/error
messages, returned versions, conflicts, draft retention, request locks, focus,
abort and absence of unrelated controls. Browser tests exercise real keyboard
flows, confirmed create/update, paging, empty/denied/errors, 409 refresh, axe and
390px responsive layout. Automated axe does not prove full accessibility conformance.

Repository-wide verification and PostgreSQL 16 CI are final required gates.
Local results are recorded in CHK-046; local success alone does not make
PEOPLE-07B VERIFIED. Exact implementation SHA requires separate push approval.
