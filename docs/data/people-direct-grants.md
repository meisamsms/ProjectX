# PEOPLE-04P — Direct grants and Add User options

PROJECTX IMPLEMENTATION DECISION; locally implemented, BLOCKED on PostgreSQL 16 CI.
Ownership, authority, lifecycle and evidence limits are in ADR-0009.

`organization_permission_grants` belongs to an OrganizationMembership and permits
canonical ORGANIZATION/SELF capabilities. `venue_permission_grants` belongs to
VenueAccess and permits canonical VENUE capabilities at its composite tenant/venue
parent. Active role and direct permissions are additive. Revocation never edits
shared roles. Positive versions, attribution, timestamps, immutable grant identity,
active uniqueness and active-parent locking are enforced. Restricted runtime has
no DELETE, owner privilege or new core-table write authority.

The Add User generated request gains optional `organizationPermissionIds` and
`venues[].permissionIds`; existing role requirements stay intact. Canonical IDs,
scope compatibility and current actor capability subsets are enforced. Unknown
fields/IDs/duplicates are rejected. No separate venue permission list can create
access outside `venues[]`. Creation, role/direct grants and pending provisioning
are atomic. Existing notification null/false/true, unverified email ownership and
idempotency remain unchanged; nonempty direct choices participate in fingerprints.

`GET /api/v1/people/accounts/options` accepts no query context. Trusted server
identity/organization require current `user.manage`. Response groups:

- `organizationRoles`: assignable `{id,name}` records only.
- `organizationPermissions`: held ORGANIZATION/SELF `{id,description,scope}`.
- `venues`: explicitly manageable `{id,name,roles,permissions}`; roles require
  the complete capability subset at that venue, permissions are held VENUE IDs.

The definer projection avoids broadening normal venue RLS. It exposes no security
internals, foreign tenant objects or global unfiltered permission catalogs.
Options do not promise future authorization; command execution rechecks authority.
Production trust binding remains outside this task, with default routes returning
401 when the trusted seam is absent. No frontend or invitation delivery is added.

New regression files: direct-grants.test.ts, direct-grants-migrations.test.ts,
direct-grants-contract.test.ts. Database suite registration includes all three;
existing migration ledger expectations gain the new checksum without changing
historical migrations. Local database execution requires a real disposable test
DATABASE_URL and is not replaced by mocks.

SevenRooms U-001/U-002/U-003 and all granular backend, role precedence/discovery,
venue source, same-access, validation, FLOW-006/Create outcomes and Export
UNKNOWN / NEEDS TESTING classifications are unchanged.
