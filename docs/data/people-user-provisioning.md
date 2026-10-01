# PEOPLE-04 organization-scoped User provisioning

Status: implemented locally; real PostgreSQL 16 and CI verification pending. This is a **ProjectX implementation decision** for the SCR-026 Add User backend. It does not claim that the reference application uses the same persistence model, identity lifecycle, duplicate policy, authorization rules, or response contract.

## Reference observations

SCR-026 visibly includes an email field and controls for profile, organization access, venue access, suspension, notification preference, submit, and cancel. FLOW-006 success, failure, cancellation, duplicate handling, invitation delivery, and later identity-linkage behavior remain UNKNOWN / NEEDS TESTING. U-001, U-002, and U-003 remain unresolved.

## ProjectX decisions

`user_provisioning_invites` is the separate organization-scoped owner of the unverified Add User email and provisioning lifecycle. It records the organization, original and normalized email, status, requester, request time, optional expiry and consumption times, idempotency key, request fingerprint, and the created User and Organization Membership references. A pending email is unique within an organization. The same email may exist in a different organization. This task creates only `PENDING` records; consumption, expiry, cancellation, email delivery, and identity linking are later explicitly scoped work.

`AuthenticatedIdentity` remains unchanged and stores only a verified OIDC issuer/subject binding. PEOPLE-04 never inserts an identity and never treats email as an identity key. A later trusted flow must verify an external identity before linking it; no linkage rule is inferred here.

`POST /api/v1/people/accounts` requires a trusted server-resolved identity and selected organization, an active `user.manage` capability, and an `Idempotency-Key` header. The request contains the unverified email, nullable existing profile fields, the existing tri-state notification preference, an explicit suspended flag, organization role IDs, and optional venue/role selections. The response contains only the provisioning, User, and membership identifiers plus `PENDING`; it does not echo email, grants, identity data, or secrets.

The command runs through the restricted runtime login and a narrow `SECURITY DEFINER` database function with a fixed search path. The function rechecks the transaction context and current capability, rejects cross-organization roles and venues, requires `venue.manage` for every requested venue, and prevents assigning capabilities the actor does not currently hold at the applicable scope. Runtime callers receive no direct privilege on the provisioning table or the newly created core records.

User, membership, organization grants, venue access, venue grants, and the provisioning record commit in one transaction or all roll back. Identical retries with the same organization, idempotency key, and canonical request fingerprint return the original result. Reusing the key for another request, or creating another pending record for the same normalized organization email, returns a safe conflict without exposing database details. `suspended=true` maps only to the existing `User.disabled_at`; nullable names, job title, and notification `null`/`false`/`true` retain their verified ownership and semantics.

No Add User frontend, email invitation, provider provisioning, session binding, identity consumption flow, role precedence, or SevenRooms parity claim is part of PEOPLE-04.
