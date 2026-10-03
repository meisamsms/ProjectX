# ADR-0010 — Add User frontend contract and interaction boundary

Status: owner-specified PROJECTX IMPLEMENTATION DECISION; PEOPLE-06 locally
implemented, final branch-head CI pending. This is not SevenRooms evidence.

PEOPLE-06 consumes the verified generated PEOPLE-04/04P command and authorized
options without changing their architecture, migrations or server security. Direct
organization/self and venue selections reflect ADR-0009's additive Option A grants.
Backend authority is rechecked at command time; the frontend is not authorization.

The owner specified normal Create navigation to SCR-025, and Create + Add Another
remaining on SCR-026 with a complete user/grant reset and fresh idempotency boundary.
Back goes to SCR-025. Notifications preserve null/true/false and pending email is not
verified identity. An unchanged ambiguous retry reuses its key; changed payloads get
a new key. State stays in memory; no token, localStorage authority or identity binding.

The UI safely maps status errors, disables duplicate submission, and announces/focuses
results. Unsupported MFA, subscriptions and invitation delivery remain unavailable.
Details and verification dependencies are in docs/data/people-add-user-ui.md.
U-001/U-002/U-003 and reference validation, role/venue/granular semantics, Create,
Add Another, FLOW-006, MFA, subscriptions and invitation outcomes remain unknown.
