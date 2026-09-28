# ProjectX authorization contract — FOUND-TASK-002

Status: INFERRED ProjectX operational contract under owner-approved ADR-0003/0004/0005. This is not a claim about the reference application's enforcement. Reference alternatives and role permissions remain UNKNOWN / NEEDS TESTING (U-002/Q-003).

## Evaluation for every protected query, mutation, job and export

1. Authenticate via verified identity; require an active server session and enabled User.
2. Resolve selected Organization and active Organization Membership on the server; deny missing or revoked membership.
3. For a Venue-scoped operation, resolve Venue's parent Organization and active explicit Venue Access for that User; reject any mismatch. Organization-level grants do not imply Venue Access.
4. Resolve current assigned role grants and effective capability IDs for this scope; verify any required step-up and field-level permission.
5. Load the target under restricted tenant context; confirm organization ownership and venue ownership where the object is venue scoped. A valid object ID never confers access.
6. Apply object-specific constraints (own-user access, client data visibility, active resource state) and transaction-local PostgreSQL RLS defense in depth.
7. Allow only when every required condition passes; otherwise deny by default and emit a safe response/audit event. Never accept client-provided user_id, organization_id, venue_id, role, permission or access ID as proof of authority.

Role display names are configuration, not authorization predicates. A user called “Manager” without active membership, matching Venue Access, explicit permission and matching resource scope must be denied. Organization-only operations require explicit organization-scoped grants; they must not silently acquire venue rights. Server-side filters, read models, background jobs, imports, exports and storage objects use the same actor/scope checks. Service jobs must carry a purpose-limited server-issued scope and recheck revocation before execution.

## Capability naming and role templates

Use singular-domain `.verb` permission IDs listed in [permission-registry.json](permission-registry.json). Scope is SELF, ORGANIZATION or VENUE. GLOBAL is intentionally unused because no platform-administration requirement has been established. SELF access applies only to the authenticated User's own permitted account fields; it does not authorize guest-profile access. Organization-level client identity/history views require dedicated organization-scoped capabilities. Venue-scoped `client.read` includes only identity fields needed for authorized venue work and that Venue's notes/history; cross-venue operational history requires `client.history.read.organization` with active Organization Membership. Never use `client.read` as a shortcut for all venue notes.

PROJECTX DEFAULT ROLE TEMPLATE examples (INFERRED, not observed reference roles): Organization Admin can be configured with explicit organization management, user access management and cross-venue client-history permissions; Venue Admin with explicit venue management; organization-scoped user access management requires a separate organization grant; Manager with operational reservation, availability and floorplan capabilities; Host with reservation and client lookup; Server with limited reservation/client view; Read Only with scoped reads. These templates confer **no privileges until assigned** to an active membership or Venue Access with explicitly enumerated permissions. Grants are editable and extensible without changing policy code. Template content and actual grants require product review and tests; no production default assignments are created here.

## Resource ownership rules

| Resource | Required ownership and permission | Basis |
|---|---|---|
| Reservation | Organization and Venue match active authorized context; `reservation.read/create/update/cancel` at Venue scope as appropriate. | APPROVED PROJECTX DECISION + INFERRED permission split |
| Client identity | Organization matches; Venue-only view must be limited to authorized service data for that Venue. Cross-Venue search only with explicit organization-scoped permission and minimized identity data. | APPROVED PROJECTX DECISION + INFERRED field policy |
| ClientVenueProfile, venue notes and visits | Organization and Venue match authorized Venue Access; protect private notes with additional field policy when introduced. | APPROVED PROJECTX DECISION + INFERRED detail |
| Table, floorplan, shift, availability rule | Organization and Venue match; resource capability and write state checks. | INFERRED |
| User account / membership / Venue Access | `user.read` for scope; organization-scoped `user.manage` to alter grants only within actor's authorized Organization and only for Venues where the actor also has explicit Venue Access, with step-up and anti-self-escalation checks. | INFERRED |
| Venue / organization settings | Match Organization and optional Venue plus `venue.manage` / `organization.manage`; secrets need separate high-risk control. | INFERRED |
| Import, export, audit entry | Bind file/job/event to Organization and Venue if applicable; dedicated capability, scope, field minimization, retention and step-up for high-risk actions. | INFERRED |

Client is an Organization-scoped identity. ClientVenueProfile is a **proposed ProjectX boundary**, not a discovered reference table. Venue-only personnel may see the minimum identity fields needed to serve an authorized guest plus their Venue's allowed operational history; they may not see other Venues' notes, preferences, visits or unrestricted group search. An explicitly authorized Organization administrator may query cross-Venue history through a dedicated grant; no Client record crosses Organizations. Reservation history inherits each Reservation's Venue visibility, even when attached to a shared Client. Exact visible fields, cross-venue search UX and reference behavior are NEEDS TESTING with isolated data and alternate roles.

## Privileged operations

| Operation | Risk | Control (INFERRED) |
|---|---|---|
| Routine own-profile read and authorized reservation read | NORMAL | Scope and capability check. |
| Reservation create/update, availability/floorplan/settings management, venue client edits | SENSITIVE | Current scoped grant, object check, audit and concurrency guard. |
| Cancel/destructive reservation action, guest deletion, cross-venue client-history access, client exports/import commits | HIGH_RISK | Explicit dedicated permission, step-up when appropriate, audit and isolated tests. |
| User management, membership or Venue Access grant/revoke, role/permission changes, integration secrets, organization settings and privileged audit access | HIGH_RISK | Narrow Organization/Venue authority, fresh step-up, prevent self-escalation, audit denied and successful attempts. |

Risk classification defines review and step-up needs; it does not claim the reference application has these controls.

## Failure and audit contract

| Failure | Future HTTP class | Result and rationale |
|---|---|---|
| Missing/expired/revoked session | 401 | Clear unusable browser context; prompt reauthentication without exposing internal state. |
| Disabled User, revoked membership or access during otherwise valid session | 403 | Invalidate affected authorization/session; do not execute operation. Client may be asked to sign in again. |
| Invalid Organization/Venue context selection, missing permission or step-up | 403 | Explicitly deny only if scope existence is already authorized; avoid leaking other tenant identifiers. |
| Unknown or cross-tenant/cross-Venue object ID | 404 | Identical safe response regardless of existence; log internal denial without exposing ownership. |

Errors use the ADR-0005 safe code/message/correlation convention without PII or membership enumeration. Authenticate before revealing context choices. Audit login (including failed privileged login where available from IdP), logout where useful, failed privileged authorization, membership add/revoke, Venue Access grant/revoke, role/permission changes, User disable/enable, sensitive Organization/Venue switches, cross-venue Client access, imports/exports and destructive attempts. Future append-only events carry actor, Organization, Venue if relevant, action, target type/id, UTC timestamp, request/correlation ID, outcome and reason code; never credentials, session secrets, tokens or raw personal data. Operational retention and IdP event coverage are UNKNOWN and require policy/provider review.
