# PEOPLE-06 — Add User frontend

PROJECTX IMPLEMENTATION DECISION. SCR-026 uses the generated PEOPLE-04/04P
contracts, not inferred SevenRooms internals. No new reference writes or observations
were performed. The authoritative task status is in roadmap.json.

## Supported form and authority

Same-origin credentials follow PEOPLE-05. GET `/api/v1/people/accounts/options`
supplies only actor-assignable role, venue and granular permission groups. The UI
uses their IDs and safe display strings, with no static permission catalog, hierarchy,
authority rule, organization selector, token or identity secret. Empty organization
roles make creation unavailable; empty permission/venue groups are shown honestly.
Venues without assignable roles are unavailable because the command requires roles.
Options are advisory: POST `/api/v1/people/accounts` rechecks current server authority,
tenant isolation and grant subsets. Browser controls are not an authorization layer.

First/Last Name and Job Title are optional; trimmed blanks become null. Email is
required by the backend and remains unverified organization-scoped provisioning
data, never verified identity. Email Notifications defaults to Not configured (null),
distinct from Enabled (true) and Disabled (false). This preference does not implement
delivery. Disabled at creation sends the generated suspended flag, mapping only to
the existing User disabled state. No other lifecycle behavior is inferred.

Organization access levels are explicit multiple role choices without precedence.
Direct organization/self and per-venue permissions are presented separately and
are additive to roles (owner-approved Option A). All selections start empty.
Every selected venue requires an explicit role; deselection removes its nested
grants. No all-venue or same-access propagation is performed.

## Actions, idempotency and errors

Normal Create navigates to SCR-025 User Accounts. Create + Add Another stays on
SCR-026, clears all profile/email/role/venue/direct/disabled values, restores
notification null, announces pending creation with no invitation claim, and clears
the idempotency boundary. Back navigates to SCR-025 without a mutation. These are
PROJECTX IMPLEMENTATION DECISION choices, not confirmed reference navigation.

The command uses the repository Idempotency-Key contract with a random UUID per
logical payload. Canonically ordered selections give unchanged retries the same key;
changed details get a new key. Failed/ambiguous requests retain their values and
boundary. Successful Add Another generates a fresh boundary on the next submission.
Keys and form data are memory-only. A synchronous ref prevents duplicate submissions;
the pending form is disabled and Back is hidden. Unmount aborts client work without
claiming that a server transaction was canceled. Email shape and contract length
limits use native controls; group validation is announced and focused.

401 requests require sign-in; 403 reports unavailable authority; 400 asks to check
the form; 409 reports a safe request conflict without foreign-record existence;
5xx/network errors report unconfirmed creation and an unchanged retry path. Raw
error bodies, SQL, constraint names, stack traces, issuer/subject and RLS metadata
are never rendered. Options failure renders no usable form. Submission error and
Add Another success receive focus; loading/results have a live status region.

Mobile MFA, Email Subscriptions and invitation/email delivery are visibly unavailable
text, not interactive controls. No OTP, enrollment, provider, secret, subscription
category, password or session work is introduced.

## Reference boundary and verification dependency

U-001/U-002/U-003 remain unchanged. Exact validation and duplicate behavior, role
precedence/ordering, venue sourcing, same-access behavior, granular permission
semantics, FLOW-006 success/failure, Create navigation, Add Another behavior, MFA,
subscriptions and invitations remain UNKNOWN / NEEDS TESTING for SevenRooms.
Reference discovery files are not rewritten. Only SCR-026 implementation route
status changes; SCR-025/SCR-083/SCR-084 and other modules remain unchanged.

Required harness integration: register the new component suite in test:web, permit
SCR-026 IMPLEMENTED in map validation, and replace the previous Add User placeholder
assertion in the SCR-025 navigation regression. No User Accounts functionality changes.
Focused component/E2E/axe and full repository gates verify synthetic data only.
Local database absence is not DB verification; final branch-head CI remains mandatory.
