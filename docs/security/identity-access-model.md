# ProjectX identity, tenant and session model — FOUND-TASK-002

**Evidence convention:** CONFIRMED means observed in the reference UI; **APPROVED PROJECTX DECISION** means the owner selected it in ADR-0003/0004, not that it reflects reference internals; **INFERRED** is a proposed ProjectX contract; **UNKNOWN** is unresolved; **NEEDS TESTING** requires isolated fixtures or another authorized role.

## Evidence and boundaries

- CONFIRMED: SCR-025 lists users by access level; SCR-026 displays granular permissions, suspension, MFA option and creating equivalent access at other venues. A venue selector and venue-specific routes were observed. SCR-139 links a reservation to SCR-140 client profile; SCR-141 exposes editable client data. These controls do not establish reference authorization behavior.
- UNKNOWN / NEEDS TESTING: reference role grants, scope inheritance, write effects, session lifetime, cross-venue search results and other-role UI. Test with authorized nonproduction accounts and isolated venues.
- APPROVED PROJECTX DECISION: Organization is the business tenant; each Venue belongs to one Organization; explicit VenueAccess is required; Clients belong to one Organization; venue-scoped operational data remains separately protected; managed OIDC identity and server sessions; scoped RBAC plus object authorization and deny by default.

## Independent ProjectX concepts (contracts, not tables)

| Concept | Responsibility | Scope / relationship | Basis |
|---|---|---|---|
| Authenticated Identity | Verified OIDC issuer and subject pair; no trust in unverified email as identity key. | Maps to exactly one local User per verified issuer/subject binding. | INFERRED |
| User | Stable internal human identity; active/disabled state; no implicit tenant access. | May have multiple Organization Memberships. | APPROVED PROJECTX DECISION + INFERRED |
| Organization | Primary tenant boundary for Clients and access grants. | Owns Venues; no cross-Organization Client sharing. | APPROVED PROJECTX DECISION |
| Organization Membership | Explicit active/revoked User-to-Organization association; organization-level grants may be attached separately. | Membership alone never grants venue access. | INFERRED under ADR-0003 |
| Venue | Operational location belonging to exactly one Organization. | Immutable parent organization as authorization invariant; reassignment requires separate reviewed migration policy. | APPROVED PROJECTX DECISION + INFERRED |
| Venue Access | Explicit active/revoked User-to-Venue grant under an active membership in the Venue's Organization; may carry venue roles. | User may hold different grants/roles at multiple Venues. Can revoke independently. | APPROVED PROJECTX DECISION + INFERRED |
| Role | Organization- or Venue-scoped, editable template/assignment grouping permission IDs; display name has no implicit power. | Grants only within active membership and matching scope; no implicit transitive venue grant. | INFERRED |
| Permission | Stable capability ID with scope and sensitive-data classification in permission-registry.json. | Resolved from active grants; object rules still apply. | INFERRED |
| Session | Opaque, server-managed authenticated browser session with revocation and expiration. | Holds identity binding, session version and selected context IDs; no durable permission graph in browser. | APPROVED PROJECTX DECISION + INFERRED |
| Authorization Context | Request-local, server-derived user, membership, organization, selected venue/access, effective permissions and resource scope. | Revalidated for each protected operation; never treated as a client claim. | INFERRED |

An identity may join multiple Organizations through separately approved active memberships (INFERRED ProjectX contract). Organization administrators need an active Organization Membership and explicit organization-scope permissions; membership alone does not entitle them to Venue data. Access for venue-only employees always requires active Venue Access and the matching permission. Org-level cross-venue client history uses an explicit organization-scope permission and object checks, not an implicit all-venue Venue Access grant. Temporary access and automatic membership inheritance are UNKNOWN requirements; no automatic expiry workflow is promised. If temporary access is later approved, it must be bounded, revocable and evaluated on every request.

## Context ownership and switching

| Input | Origin and trust |
|---|---|
| OIDC issuer/subject | Verified server-side during login; mapped to internal User. Never derive authority from email or a user-supplied user_id. |
| session_id | Opaque server-issued secure cookie; only a lookup key, not a role or tenant claim. |
| organization_id | User may request a switch, but server confirms active membership and recomputes grants. |
| venue_id | User may request a switch, but server confirms parent Organization and explicit active Venue Access. |
| membership_id / venue_access_id / permission set | Resolved server-side against active records, checked for revocation/version; never accepted as authority from headers, route, token or body. |
| target resource IDs | Select objects only after organization/venue ownership and permission checks; knowledge of an ID grants nothing. |

Switching Organization validates active membership, clears the previous Venue, returns only authorized Venue choices and recomputes permission context. Switching Venue validates its Organization, explicit Venue Access and current permissions. On any failure, deny the switch and retain or clear prior context safely; never accept the requested scope as authorization. A disabled User, revoked membership or revoked Venue Access invalidates affected context immediately at the next guarded request; actively revoke affected sessions or bump grant/session version to avoid stale access (INFERRED design requirement).

## Future server session contract

Use an opaque random session identifier in Secure, HttpOnly, SameSite browser cookie with CSRF protection for mutation requests. Server-side session records bind user_id and authenticated issuer/subject, creation and last-activity times, absolute and idle expiry, IdP MFA assurance if verifiably supplied, selected organization_id and optional venue_id, revocation/version and last step-up time. Never store bearer credentials or a full permission graph in client-controlled data. Rotate the session on authentication, privilege change and step-up. Logout revokes local session and clears cookie; federated IdP logout behavior is provider-dependent (UNKNOWN). Refresh grants on protected operations or via a demonstrably immediate revocation/version mechanism; deny on stale/missing versions. Exact timeout durations, MFA assurance levels, provider choice and reauthentication interval are NEEDS TESTING / future security policy decisions before implementation. Elevated user, role, export, secret and destructive operations require fresh reauthentication or verified MFA step-up according to the operation's risk; a failed step-up denies the action.

## FOUND-TASK-003 input contract

Persistence design may rely on stable local User IDs, verified external identity binding, Organization ownership, single-parent Venue, independently revocable Organization Membership and Venue Access, scope-specific role/permission grants, server session version/revocation, resource organization_id and venue_id where applicable, and append-only access audit metadata. PostgreSQL RLS must receive only server-verified transaction-local organization/venue context and a restricted execution identity. Policies must prevent pooled-connection context leakage and support authorized organization-level cross-venue reads without granting venue-only users cross-venue data. FOUND-TASK-003 chooses physical keys, constraints and policy SQL and proves negative tests; none are designed or executed here.
