# ADR-0009 — Direct scoped People grants and authorized options

Status: OWNER APPROVED, implemented locally; PostgreSQL 16 CI pending.

## Decision and scope

PROJECTX IMPLEMENTATION DECISION. The owner selected Option A for PEOPLE-04P:
OrganizationMembership owns direct ORGANIZATION/SELF permission grants;
VenueAccess owns direct VENUE permission grants. Effective rights are the union
of active role-derived and direct rights. Shared Roles/RolePermission remain
unchanged; there are no private user-specific roles or role-name authority.
This does not establish any SevenRooms internal behavior.

PEOPLE-04P owns the additive persistence, current capability lookup, RLS, narrow
Add User extension and options contract. PEOPLE-02/04 are predecessors. Updating
their capability/command seams is required to make the options consumable;
their VERIFIED historical evidence is retained. PEOPLE-06 frontend stays blocked.

## Grant authority

The verified role-subset rule is extended to direct grants: require current
organization `user.manage`; every requested ORGANIZATION/SELF capability must be
currently held at the organization. At each explicit venue require active
membership/access, current `venue.manage`, and every requested VENUE capability
at that venue. Neither organization authority alone nor role names authorize
another venue. Permission IDs and scopes come from the canonical registry.

Disabled users, revoked memberships/access, and revoked role/direct grants lose
authority on subsequent transaction-time lookups, without session permission
caches. No negative/deny grants or precedence rules are introduced. Concurrent
authority changes retain PEOPLE-02's transaction-time semantics; this is not a
new globally serializable revocation guarantee.

## Persistence and lifecycle

Forward-only `people-z-direct-grants/20261001000600_people_direct_grants.sql`
sorts after the existing provisioning migration in the current runner. Composite
tenant/venue foreign keys, canonical scope foreign keys, active-parent triggers
and partial unique indexes protect ownership and active duplicates. Grant
ownership, permission and attribution are immutable; revocation/reactivation
requires the next integer version, updates timestamps, and retains history.
Attribution records `granted_by_user_id`. Existing role tables are not rewritten.
No physical DELETE or unrelated runtime privilege is added. Durable audit event
delivery, step-up authentication and new grant-management routes remain outside
this slice; metadata must not be represented as those completed features.

## Command and options

Generated OpenAPI types define optional `organizationPermissionIds` and
`venues[].permissionIds`. Existing mandatory role selections are retained for
backward compatibility; this slice does not add role-free account creation.
Omitted/empty direct selections preserve the existing request fingerprint.
Sorted nonempty selections are included in fingerprints. The new narrow definer
command validates direct authority, calls the verified command under its
idempotency lock, and inserts direct grants only on first creation. All writes,
including pending provisioning, roll back together. No OIDC identity, email
delivery, invitations, MFA or session redesign is introduced.

`GET /api/v1/people/accounts/options` uses the same trusted identity/organization
seam and current `user.manage`. It returns organization role and permission
groups plus explicit manageable venues, each with its own role/permission groups.
Each role's entire permission set must be assignable in that exact scope. Empty
groups are valid. Options are advisory; creation rechecks current authority.
Only IDs, names, existing permission descriptions and scopes are projected.

A fixed-search-path, revoked-from-PUBLIC definer options function is necessary
because ordinary venue RLS intentionally reads only the selected venue. It
rechecks current organization authority and explicit venue authority without
broadening table SELECT policies. New tables grant only SELECT/INSERT/UPDATE
under scoped RLS; insert/reactivation require capability-subset authority.

## Verification and evidence boundary

PostgreSQL tests cover persistence/additivity, scope/tenant/parent constraints,
revocation, restricted-runtime reads/writes, command rollback/idempotency,
options filtering and clean/PEOPLE-04-upgrade/checksum/repeat migrations. Local
contract validation is not a database substitute. PEOPLE-04P remains BLOCKED
until both real PostgreSQL 16 CI gates pass on the final published branch head.
SevenRooms U-001/U-002/U-003, granular semantics, role precedence/discovery,
venue source, same-access behavior, validation, FLOW-006 outcomes, Create + Add
Another and Export remain UNKNOWN / NEEDS TESTING.
