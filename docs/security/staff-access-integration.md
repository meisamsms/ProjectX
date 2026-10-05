# CORE-AUTH-01 — Trusted staff access integration specification

## CORE-AUTH-02 implementation checkpoint — 2026-10-05

PROJECTX IMPLEMENTATION DECISION, not SevenRooms evidence. The dated inventories
below remain historical specification/base evidence. Runtime integration is now
implemented under ADR-0003/0004 and CORE-AUTH-D004: maintained openid-client Code +
PKCE S256 with explicit JWS validation; exact issuer/subject binding; PostgreSQL
opaque sessions; cookie/CSRF/current-context resolver; restricted startup pool;
minimal web continuity. No email enrollment, provider token persistence, new owner
policy, guest auth, reservation domain or Export. See
`staff-session-database-review.md` and `staff-session-verification.md`.

Production/staging fail closed unless STAFF_AUTH_ENABLED=1 and all seven required
Auth0/origin/runtime DB inputs validate. Inject AUTH0_CLIENT_SECRET outside Git.
Issuer is an exact HTTPS root with trailing slash; callback is the canonical
origin + /api/v1/staff-auth/callback; client ID is the ID-token audience. Configure
separate registrations/secrets for each environment. AUTH0_POST_LOGOUT_URI is
validated configuration, not an implemented federated logout endpoint.

The shared migration runner installs the new auth-only migration after all eight
historical People migrations. Runtime login must inherit projectx_people_runtime
and projectx_staff_auth_runtime without owner, superuser, BYPASSRLS or broad-role
authority, including assumable parent roles. No runtime direct auth-table grants.
Deployment provisioning/migration remains an explicit controlled gate; the
disposable test harness is not a production migration tool.

HTTPS same-origin gateway must preserve the configured Host and strip/reject
X-Forwarded-Host; no request-derived proxy trust or wildcard credentialed CORS.
Configure VITE_STAFF_AUTH_ENABLED=1 for the staff web build. The optional foundation
demo shell is not authentication and cannot bypass server authorization. Only
successful mutations refresh idle activity; GET polling never extends the 30m
idle or 12h absolute bounds. Login correlations have a five-minute one-use protocol
TTL; this is not a new staff-session or privileged-assurance timeout.

The web retains a per-tab context version; it never silently refreshes/replays a
409 mutation. Successful selection remounts context-owned pages. Only current
actor context IDs are exposed; a large selector/name-management UI is out of scope.
Local logout is durable before cookie removal and independently revocable.
Provider tokens, raw cookies, callback URLs and verifier/state/nonce are not logged;
automatic request-URL logging is disabled and safe auth event metadata is used.
These events are not a durable audit subsystem or PEOPLE-D010 reuse.

Assurance representation is UNVERIFIED. The existing high-risk Add User POST is
denied for real staff sessions until controlled Auth0 MFA/auth_time and freshness
evidence exists. No browser MFA claim can elevate it. Ordinary venue operations
retain current People/RLS capability checks without blanket repeated step-up.
Targeted approximately-five-minute policy is unchanged; no verified-MFA timestamp
is manufactured from baseline auth_time.

CORE-AUTH-02 remains IMPLEMENTED, not provider/production VERIFIED. Controlled
Auth0 login/callback/logout/cookie/revocation/multi-instance and MFA assurance
verification, deployment role/TLS/gateway registration checks and exact-SHA CI
publication remain gates. No real Auth0 tenant/credentials were created or used.
All prior VERIFIED history and SevenRooms UNKNOWN / NEEDS TESTING remain intact.

Date: 2026-10-04. Base: `7f2c25f532a5efae22237c3f9c42b1e528dadf8a`.
DOCUMENTATION ONLY / PROJECTX IMPLEMENTATION SPECIFICATION under approved
ADR-0003/0004. Requirements below are future acceptance contracts, not implemented
or production-verified behavior. No new architecture or provider purchase,
credentials, runtime, migration, test, API contract or reference evidence is added.

## Current owner-approved policy — CORE-AUTH-D004

OWNER APPROVED / PROJECTX IMPLEMENTATION DECISION, 2026-10-04; documentation base
`95d4d1b1cc9f8a6dc69a1d8a3edea38df9e00923`. Next unused consolidated decision ID
CORE-AUTH-D004 resolves existing CORE-AUTH-D001/D002/D003, preserving their IDs and
original options. Explicit selections: 1B Auth0; 2A session policy; 3A targeted MFA.
This specializes ADR-0004; no redundant ADR or SevenRooms inference.

- Managed OIDC provider: **Auth0**, staff authentication only for the current
  reservation-core milestone. Standard OIDC Authorization Code + PKCE, secure
  callback, issuer/audience/signature/expiry/state/nonce checks and exact verified
  issuer/subject mapping remain mandatory. No email-only identity linking or
  browser-authoritative User/Organization/Venue claims.
- Separate development, staging and production configuration. No Auth0 tenant,
  client registration, credential or secret is created here. Exact issuer/client/
  callback/origin/proxy configuration and secret provisioning are controlled future
  CORE-AUTH-02 inputs; missing values fail closed before exposure. They are not an
  additional unresolved product/architecture choice.
- Staff sessions: **12 hours absolute**, **30 minutes idle**, **multiple sessions
  allowed**, opaque server-managed state. Secure, HttpOnly, SameSite=Lax, host-only
  cookie, Path=/; production HTTPS. Rotate after authentication/security-sensitive
  reauthentication where applicable; server invalidation before logout cookie
  removal. Current disabled/revoked authorization state remains authoritative;
  permissions never frozen into long-lived browser claims.
- Ordinary staff book/check-in/seating and ordinary reservation operations do
  **not** require repeated step-up and are not automatically high-risk. High-risk
  user/role/permission administration and highly sensitive security configuration
  require MFA/recent privileged assurance, with approved freshness target
  **approximately 5 minutes**. Exact Auth0 feature/claim/enforcement mechanics belong
  to CORE-AUTH-02 design and verification; no extra timeout values invented. Policy
  approval is not assurance verification; unverified/missing assurance still denies
  privileged actions. No full administration redesign is authorized.

All required owner choices are resolved; no additional required product/architecture
decision found in this specification. CORE-AUTH-02 is READY for a separate bounded
implementation prompt, not implemented. Least-privilege identity/session bootstrap
review and registered environment/provider verification remain its engineering
acceptance gates. If that work discovers a genuinely new decision, stop and record
it rather than widen scope or weaken RLS. Core readiness remains UNMET.

## Task-selection gate and reservation boundary

TASK ID: CORE-AUTH-01. PRIORITY PART: PART 2 — REQUIRED FOUNDATION.
CORE WORKFLOW ADVANCED: Secure staff access to reservation-required Venue settings,
then staff reservation book/check-in/seating (SETTINGS-CORE-01 and
RESERVATIONS-CORE-01). DEPENDENCIES: PRIORITY-001, PEOPLE-CORE-01 and
FOUND-TASK-004 VERIFIED in their existing documentation/security/toolchain scopes.
WHY REQUIRED NOW: A branded UUID cannot authenticate a real staff member; the
startup lacks identity/session/resolver/pool integration. Protected settings and
guest-data writes cannot be exposed on a caller assertion alone.
OWNED SCOPE: Evidence inventory, ADR-0004 integration contract, owner choices,
future negative tests and CORE-AUTH-02 gate. EXCLUDED: implementation, new identity
architecture, public guest auth, reservation domain, broad People refactor, generic
audit, unrelated settings and Export. ACCEPTANCE: all boundaries below specified,
uncertainty explicit, prior verified/reference history retained. VERIFICATION:
`pnpm map:check`, `git diff --check`, JSON/ID/DAG/history/scope assertions.
REGRESSION: no runtime/test/migration/contract or existing approved ADR changes.
DECISION: CORE-AUTH-01 specification VERIFIED; CORE-AUTH-02 now READY after D004,
but no implementation in this owner-decision documentation task.

PART 1 remains the delivery goal. PEOPLE-09 READY is planning readiness only;
PEOPLE-09B/10 PLANNED; all three PART 3 DEFERRED FOR CORE DELIVERY until
CORE-READY-01 or explicit owner exception. No automatic implementation follows
this specification. After approved auth integration, return to SETTINGS-CORE-01,
not an extended identity project or Export.

## Actual repository inventory

Here CONFIRMED means inspected **ProjectX repository evidence**, not newly observed
SevenRooms behavior. INFERRED means a proposed requirement; UNKNOWN means not
established; NEEDS TESTING means future isolated integration evidence is required.
Absence findings cover the tracked startup/routes/dependencies inspected at base,
not undisclosed deployment infrastructure.

| Finding | Classification | Evidence / limitation |
|---|---|---|
| Startup calls `loadConfig(process.env)` then `createApp(config)` without options. | CONFIRMED | `apps/api/src/main.ts`; config contains environment/host/port/log level only. |
| `createApp` supports injected Accounts/Add User/Booked By/Server Names dependencies, including trusted-scope resolver and runtime pool. Startup supplies none. | CONFIRMED | `apps/api/src/app.ts` and People route interfaces. No production resolver/pool wired here. |
| `bindVerifiedPeopleIdentity` checks UUID syntax, freezes an object and adds a private Symbol brand. It performs no issuer/subject/token/session/database verification. | CONFIRMED | `apps/api/src/people/authorization/context.ts`; caller must already have verified identity. |
| Missing dependencies/resolved scope fails closed for protected requests. | CONFIRMED | Booked By route returns safe 401 for otherwise valid requests; contract tests assert this. Invalid DTOs can return 400 first; health stays public. No protected data/operation callback is authorized. |
| User/Organization/Venue context is supplied by an injected server caller, not resolved from a production browser session. | CONFIRMED | Booked By service scope and route; Accounts read has Organization scope. No inference that every operation requires Venue. |
| Tests brand synthetic fixture User IDs and inject resolvers; restricted PostgreSQL fixture pool is separate from admin seeding. | CONFIRMED | `apps/api/tests/people/{booked-by.test.ts,authorization.test.ts,fixtures/runtime.ts}`. Test authentication is not production login. |
| Existing capability/RLS boundary checks enabled User, active membership/access, current scoped role/direct grants on each authorized operation. | CONFIRMED | People authorization and RLS/direct-grant migrations/tests; historical CHK-023/039/051 retained, not rerun here. |
| Production login/callback, session middleware/store, staff session cookie issuance, CSRF enforcement, logout and Venue-switch endpoint are not implemented in inspected tracked startup/routes. | CONFIRMED | Source inventory/search of `apps/api/src`; cookie redaction is logging, not session middleware. `tenant-context.ts` is an interface, not an authenticator. |
| API direct dependencies are contracts, Ajv, Fastify and pg; no declared OIDC/session/cookie/CSRF plugin. | CONFIRMED | Root/API package manifests and lockfile importers. Transitive packages do not prove configured authentication. |
| Real production deployment identity integration, provider configuration and end-to-end session invalidation are not established. | UNKNOWN / NEEDS TESTING | No deployment/provider credentials examined or requested. Missing local integration is not proof about undisclosed infrastructure. |
| Existing authorization helpers can remain module-consumption seams after real identity verification. | INFERRED / NEEDS TESTING | Adapter must preserve denial, current grants and restricted-RLS behavior; not an assertion of production readiness. |

All pre-existing reference classifications, U-001/U-002/U-003, role/validation/
MFA/invitation/Export unknowns remain unchanged. No reference identity internals or
backend/frontend parity claim is made.

## Approved boundary and OIDC contract

Managed OIDC provider -> ProjectX callback -> server token verification ->
AuthenticatedIdentity/User mapping -> opaque server session -> server-resolved
Organization/Venue -> current ProjectX authorization -> restricted runtime/RLS.
Authentication identifies a User; it never supplies Organization, Venue or grants.

Use authorization-code flow with server-side exchange and PKCE S256, including
the confidential web client. No implicit flow, browser token-as-session or
client-supplied User-ID shortcut. A provider without required support needs review,
not silent downgrade. Create random, one-use, expiring state/nonce/PKCE values;
bind them to the initiating browser and intended configured issuer/callback.
Consume the login transaction atomically; duplicate/replayed callbacks cannot
create another session. PKCE verifier never goes to browser storage or logs.
These code-flow safeguards follow [OAuth security BCP, sections 2.1/4](https://www.rfc-editor.org/rfc/rfc9700.html#section-2.1).

Allow only configured HTTPS issuers; no request-driven discovery/JWKS URLs.
Exact-match returned issuer against the login transaction and configured issuer.
Allowlist callback URI and provider endpoints per environment; no wildcard
redirect, open redirect, untrusted Host or forwarded-header-derived callback.
Return-to is a server-validated local path, not arbitrary URL. Default to top-level
GET code callback; a different response mode requires reviewed cookie compatibility.

Server validates ID-token signature using the configured issuer's keys and a
registered algorithm allowlist (reject unsigned/algorithm confusion), client
audience and applicable authorized-party claims, expiry and relevant token time
constraints with bounded documented clock skew, nonce, issuer and nonempty subject.
Reject ambiguous audience/issuer/claims or failed key retrieval; never bypass
verification. Validate required assurance/authentication time if step-up is used.
Use a maintained standards-compliant adapter, not handwritten JWT verification;
package selection/version review belongs to CORE-AUTH-02 after provider approval.
Identity validation is grounded in [OIDC Core 3.1.3.7 and 5.7](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation).
ProjectX requires signature verification even where a protocol permits a different
verification method. Minimal `openid` scope; no refresh/offline token retention
unless a concrete separately reviewed need exists. Provider secrets stay server-side.

## Local identity mapping and bootstrap boundary

Map exact case-sensitive verified `(issuer, subject)` to existing
`authenticated_identities` -> `users.id`; do not trim, lowercase, normalize issuer
paths or substitute email for this key. PEOPLE-01 enforces `UNIQUE(issuer, subject)`
and User foreign key. Unknown/unlinked identity produces generic access-denied /
onboarding-required, no automatic User, membership or grant creation. Enrollment,
provisioning consumption and additional-account linking require their own approved
flow; same email (even verified) never links accounts automatically.

An existing User with `disabled_at` is denied (403 after valid identity proof),
and existing sessions must cease authorizing. Current AuthenticatedIdentity has
no `revoked_at`/enabled/version column; do not invent one. Missing/removed/rebound
binding must invalidate its sessions; any new per-identity revocation lifecycle
requires reviewed persistence scope. Provider account/token revocation visibility
is provider-dependent, UNKNOWN until the approved adapter/event policy is tested;
local User/session/grant revocation does not depend on provider notifications.
Duplicate/ambiguous mapping fails closed; uniqueness violations never choose a
different User. Authentication conveys no cross-Organization privilege.

CONFIRMED integration prerequisite: existing identity RLS needs SELF context and
current capability; it is not an anonymous issuer/subject bootstrap query. Likewise
roster/venue visibility is not a safe all-user context-picker query. CORE-AUTH-02
must review a narrow server-only identity/session/current-context lookup contract
before implementing persistence access. It must return only the verified binding,
enabled state and the current actor's authorized choices, not expose arbitrary
User/tenant lookup or roster access. No fake User GUC, admin pool, blanket SELECT,
disabled RLS, BYPASSRLS or browser-callable arbitrary-user lookup can bridge this
gap. Least-privilege database grants/policies and any narrow privileged function
must receive dedicated negative tests and documented review before exposure.
This specification defines constraints, not new SQL/privileged-function architecture;
record an ADR if that subsequent design changes approved architecture. CORE-AUTH-02
owns this auth-only integration prerequisite; no separate broad People project.

## Session, cookie and lifecycle contract

Use a cryptographically random opaque cookie credential, at least 256 random bits,
accepted only through the designated cookie, not URL/body/localStorage/User headers.
Server persistence stores a one-way verifier rather than reusable cookie secret,
User and identity binding, creation/absolute expiry, last accepted activity/idle
expiry, revocation/version, optional selected Organization/Venue, validated provider
assurance/auth time and last successful step-up. Permissions are never frozen into
the cookie/session as durable authority. Shared persistent storage across API
instances, bounded reads/writes and atomic consume/rotate/revoke are required;
an in-memory production store is insufficient. Physical session schema/store access
is CORE-AUTH-02-owned future design, not a table/migration approved here.

Proposed host-only `__Host-projectx-session`: Secure; HttpOnly; SameSite=Lax;
Path=/; no Domain. Lax permits the specified top-level GET OIDC callback; it is
not mutation authorization. Production and staging HTTPS required; explicitly
isolated local test setup may use loopback HTTPS, never weaken production settings.
Configured canonical origin/proxy trust boundary required. Cookie expiry cannot
outlive server expiry; no persistent remember-me in this milestone. Session
responses use no-store; minimize referrer leakage on login/callback pages.
Cookie/verifier requirements draw on [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#cookies).

Create the authenticated session only after successful callback verification,
binding and enabled-User check. Never elevate/reuse a pre-auth session ID. Rotate
atomically at authentication and successful step-up, and on detected privilege
elevation; invalidate the predecessor and rebind CSRF state. Idle activity cannot
extend the original absolute expiry; renewal is never silent unlimited login.
No refresh extends local policy. Failed/replayed rotation cannot resurrect old
credentials. D002/D004 approve 12 hours absolute / 30 minutes idle, with multiple
sessions allowed; policy is selected, not implemented or deployed. Background polling
must not silently keep an unattended terminal alive; CORE-AUTH-02 defines/tests
accepted interactive activity and expiry race handling.

Every request checks active unexpired/unrevoked session and current enabled User /
identity binding. Logout is a CSRF-protected state change: server invalidation
before cookie removal, idempotent for an already expired session. Store failure
does not report successful logout/invalidation; fail safely and do not authorize
on unavailable storage. Local logout invalidates this session; global User/session
revocation must be server-enforced. Federated/global IdP logout is provider-dependent,
not promised. Approved multiple sessions remain independently revocable;
no shared-terminal bypass or unapproved session-list UI.

## CSRF, origins and login/error states

Authenticated staff POST/PUT/PATCH/DELETE require a session-bound unpredictable
synchronizer CSRF token in an explicit request header, plus exact configured
source-origin validation. Token acquired only from same-origin authenticated
response, never URL/log; rotate with session. Missing/mismatched token denies
before callback/write. Require Origin matching scheme/host/port; if absent,
allow only a validated same-origin Referer; reject null/foreign origins and requests
with neither trusted source. Destination Host must match deployment allowlist;
trusted proxy handling is fixed configuration, not arbitrary forwarded headers.
No wildcard credentialed CORS. SameSite/Fetch Metadata are defense in depth, not
token substitutes. State-changing GET is forbidden except the narrowly validated
OIDC login/callback protocol using its own state/nonce/PKCE boundary. Public guest
routes retain their separately scoped future access/CSRF contract.
See [OWASP CSRF tokens and origin guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

| Future boundary | Safe behavior |
|---|---|
| Unauthenticated web staff | Explicit login initiation/redirect to configured provider; safe local return path. API does not redirect to HTML/IdP. |
| Invalid callback/state/nonce/code/token | Generic login failure; consume/clear pending transaction; no authenticated cookie. No provider internals. |
| Unknown identity | Generic denied/onboarding-required, no automatic enrollment or account enumeration. |
| Disabled User after valid authentication | 403/session denied; invalidate local sessions; no operation. Subsequent unusable session can return 401. |
| Missing/forged/expired/revoked session | Safe API 401; clear unusable cookie; web returns to login without losing data through automatic mutation replay. |
| Revoked membership/access or missing capability | 403 for known own context; clear inaccessible scope; no domain operation. Foreign/nonexistent IDs give indistinguishable safe not-found/denied responses. |
| Dependency/store unavailable | Safe generic failure, never fall back to fixture identity or permissive access. |
| Logout | Invalidate server record, then expire same-name/path cookie; no silent IdP logout claim. |

Preserve safe code/message/request-ID error convention (ADR-0005); no PII, SQL,
membership enumeration, tokens or internal provider diagnostics in responses.

## Trusted scope, current authority and Venue switching

Resolver contract consumed by modules: server-verified User identity, validated
Organization ID, optional Venue ID required only by Venue-scoped operations, and
server session/request attribution. Attribution is a non-secret correlation ID,
not cookie credential. Resolver checks session/User/binding; validates active
OrganizationMembership, Venue parent and explicit active VenueAccess; module
authorization checks current required capability, target and RLS. Org-only operations
do not acquire implicit Venue rights. Existing People binder remains the final
branding step after those checks, never evidence of authentication itself.

Sessions can remember context IDs, but every protected operation rechecks current
authority from persistence. No authorization cache is proposed (TTL zero across
requests). Role and direct grants remain additive under existing PEOPLE-04P; names,
provider groups, browser permission arrays and cached role claims grant nothing.
Revoked User/membership/access/role/direct grant is denied on the next guarded
operation after revocation commits. Do not promise retroactive interruption of
already committed/in-flight work; sensitive future writes define their locking/
concurrency checks. Session expiry/revoke checked on each request. Future caching
would need an explicit maximum TTL and accepted revocation tradeoff, not silent
policy drift. Detected privilege changes clear stale assurance/rotate as appropriate
without keeping revoked rights valid until rotation.

| Current access situation | Future server behavior |
|---|---|
| No accessible Venue | Authenticated no-Venue state; no Venue reads/writes; org-only operations still need explicit org capability. |
| Exactly one accessible Venue | May select it after current membership/access validation. |
| Multiple accessible Venues | Safe explicit selection from only current actor's allowed choices; no arbitrary first Venue fallback. |
| Revoked selected Venue / stale selection | Deny pending Venue operation, clear selected Venue, offer only remaining authorized choices. Never silently replay a write at another Venue. |
| Revoked Organization membership | Clear affected Org and Venue, deny its operations; other memberships confer only their own separately selected authority. |
| Disabled User / stale invalid session | Invalidate session; deny all protected operations. |

Multi-Venue semantics already follow ADR-0003 and identity model. Cosmetic selector
layout is non-blocking; no additional owner decision on that architecture is needed.
Conceptual future CSRF-protected context-switch command (not an API/OpenAPI contract
or implemented endpoint): request candidate Org/Venue; resolve only actor-accessible
scope; atomically update session context version; next request revalidates selected
context. Changing Org clears old Venue before selecting a validated new one.
Failed switch cannot persist requested IDs; keep prior validated context or clear
it if revoked. Foreign/nonexistent candidate IDs have identical denial responses.
Switch does not add grants. Prevent concurrent tabs from silently retargeting a
write: mutations must be bound to the context/version in which the form was opened,
compare it with validated server session context, and reject stale mismatch before
work. Any echoed version/scope is a conflict guard, never authorization. In-flight
requests use their immutable validated scope, not a mutable global variable.

## Database/RLS integration and step-up

Runtime pool must use a non-owner, non-superuser login with only reviewed privileges
(existing `projectx_people_runtime` inheritance for People), never migration/admin
credentials or BYPASSRLS. Separate bootstrap/session access must also be restricted;
no admin request pool. Validate role/ownership at startup and fail closed on bad
configuration; health is not proof of authenticated readiness. Pool cleanup/close
and missing-config behavior need tests. Existing helper hardcodes `projectx_test`
search_path: deployment schema configuration/qualification requires bounded review
and tests, not rewriting historical migrations or pretending test schema is a
verified production setup.

For every authorized transaction establish fresh trusted User/Org/Venue/access
mode with transaction-local settings; absent Venue must not inherit any prior
value. RLS remains active, queries parameterized; custom GUCs alone are not identity
proof. Commit/rollback/release clears context; a broken rollback destroys the
connection rather than returning polluted state. Test raw pooled reuse after success,
denial/error and org-only after Venue request. Existing People policies do not
automatically secure future settings/reservation/client tables; each core module
must add its own approved RLS/object tests before exposure.

No blanket new MFA/step-up on ordinary staff reservation reads/create/update/
check-in/seating or minimum non-secret Venue settings solely due to this task.
Keep current sensitive-operation authorization/audit/concurrency rules. Existing
identity-access/authorization contracts still require fresh reauthentication or
verified MFA for high-risk user/grant/role administration, secrets and Organization
settings; cancellation/destructive operations keep their risk-specific review.
Never expose those routes with only baseline session authentication. D003/D004
approve targeted privileged MFA/recent assurance with approximately 5-minute
freshness; exact Auth0 mechanics remain NEEDS TESTING. Without verified assurance,
privileged mutations stay denied, not weakened. No People-admin rewrite
or step-up UI is a prerequisite to implementing ordinary staff access. Verified
`auth_time`/provider assurance mapping, not a browser `mfa=true` or recent page visit,
must support any accepted step-up. Existing tests do not prove production step-up.

## Minimal security logging, not a generic audit architecture

Future login success/failure, logout, local session revoke and validated context
change emit allowlisted metadata through existing structured-redacted logger:
event/result, UTC time, request ID, server-verified actor/scope where available and
bounded reason code. Unknown login failure must not invent User/tenant attribution.
Never log ID/access/refresh token, raw session secret, authorization code, client
secret, callback query URL, PKCE verifier, cookie, arbitrary provider payload or PII.
Current redaction alone is not sufficient: callback request-URL logging must be
suppressed/sanitized and covered by secret-canary tests before exposure.

No durable authentication audit writer is implemented or approved by PEOPLE-D010;
it is export-only and stays deferred. ARCH-D014/017 remain PROPOSED. Persistent
security-event storage/retention, IdP event delivery and any required privileged
durable audit need a separately reviewed scoped boundary, not reuse of name-history
writers or an implicit generic subsystem. Do not claim stdout/logs prove durability.

## CORE-AUTH-02 future negative test matrix

All tests below are NEEDS TESTING, not executed in this specification. Each denial
must prove no unauthorized operation/data/partial write and safe non-leaking output.
Use disposable Users/ORG-A with A1/A2/ORG-B with B1 and restricted PostgreSQL 16
connections. Controlled provider tests are separate from synthetic resolver tests.

| ID | Case | Required result |
|---|---|---|
| AUTH-N01 | Missing session | API 401; no module callback. |
| AUTH-N02 | Forged/unknown session ID | 401, no User/tenant lookup disclosure. |
| AUTH-N03 | Absolute/idle-expired session | 401; polling/renewal cannot bypass expiry. |
| AUTH-N04 | Revoked session | Next request 401; no resurrection. |
| AUTH-N05 | Disabled User | Valid proof denied 403; sessions unusable. |
| AUTH-N06 | Revoked OrganizationMembership | Affected scope denied/cleared. |
| AUTH-N07 | Revoked VenueAccess | Affected Venue denied next operation. |
| AUTH-N08 | Missing permission | 403; role name alone grants nothing. |
| AUTH-N09 | Forged User ID header/body | Ignored/rejected; cannot substitute actor. |
| AUTH-N10 | Forged Organization ID | No foreign scope or existence disclosure. |
| AUTH-N11 | Forged Venue ID | No foreign scope/data. |
| AUTH-N12 | Venue belongs to another Organization | Denied despite valid known ID. |
| AUTH-N13 | Inaccessible Venue selection | Switch denied; candidate not saved. |
| AUTH-N14 | Stale session after grant revocation | Current state denies, no frozen permissions. |
| AUTH-N15 | Pool reuse across tenants and org-only mode | No leaked settings/rows after commit/rollback/denial. |
| AUTH-N16 | Invalid/unapproved OIDC issuer | No mapping/session; no attacker discovery URL. |
| AUTH-N17 | Invalid audience/authorized party | No session. |
| AUTH-N18 | Expired/not-yet-valid token | No session under bounded clock-skew policy. |
| AUTH-N19 | Bad signature/unsigned/algorithm confusion | No session; fail on unusable issuer keys. |
| AUTH-N20 | Missing/mismatched/reused state | Safe callback failure, no login CSRF. |
| AUTH-N21 | Missing/mismatched nonce | Safe callback failure. |
| AUTH-N22 | Replayed callback/code and bad PKCE | Atomic single-use; no second session. |
| AUTH-N23 | CSRF absent/mismatched (all four methods) | Denial before write including switch/logout. |
| AUTH-N24 | Foreign/null Origin, spoofed Host/proxy | Denied; absent Origin requires valid Referer. |
| AUTH-N25 | Reuse after logout | Old credential denied after durable invalidate. |
| AUTH-N26 | Fixation and rotation predecessor | Pre-auth/old credential never authorizes. |
| AUTH-N27 | Unknown binding, duplicate pair, same-email stranger | No auto-link/User/grant creation. |
| AUTH-N28 | Missing/changed binding mid-session | Session denied/invalidation, not substituted User. |
| AUTH-N29 | Revoked role/direct grant or capability mapping | Denied next operation, additive rights unchanged. |
| AUTH-N30 | Session/bootstrap store unavailable | Fail closed; no admin/fixture fallback. |
| AUTH-N31 | Stale tab/context-version mutation | No wrong-Venue write or auto-replay. |
| AUTH-N32 | Stale/unverified step-up for privileged route | Denied; browser assurance cannot elevate. |
| AUTH-N33 | Callback/token/session secrets in log canaries | None in request URLs/events/errors/responses. |
| AUTH-N34 | Runtime bootstrap/session privileges | No arbitrary actor/tenant enumeration, direct broad writes, owner/BYPASSRLS. |

Positive controls: verified linked enabled User, authorized one/many/no-Venue states,
valid login/rotation/logout, authorized CSRF mutations and same-scope People
regressions. Pin focused test commands once files exist; do not invent commands or
claim mocks prove a managed provider works. Future gates: `pnpm format:check`,
`pnpm lint`, `pnpm typecheck`, `pnpm contract:check`, `pnpm map:check`, `pnpm verify`,
`pnpm verify:db`; controlled IdP callback and affected browser keyboard/focus/axe
checks, real PostgreSQL privilege/RLS/cleanup evidence. Required secrets belong in
approved environment configuration, never this spec or commit.

## Owner decisions — resolved by CORE-AUTH-D004

Authoritative structured records: `docs/project-map/decisions.json`.
The questions/options below preserve the original consideration history, not
current blockers or newly approved alternative timeout values. D001/D002/D003 are
now APPROVED by explicit owner selections 1B / 2A / 3A; D004 consolidates policy.

### CORE-AUTH-D001 — Managed provider and deployment configuration

QUESTION: Which managed OIDC provider/tenant and environment registrations may
ProjectX use? WHY IT MATTERS: recurring cost, staff enrollment/SSO, recovery, approved
issuer/client/callback/origin, assurance mapping and controlled verification depend
on the owner's account and deployment authority. ADR-0004 approves the strategy,
not a vendor. Options below are selection paths, not vendor recommendations.

| Option | Pros | Cons |
|---|---|---|
| A — Use an owner-confirmed existing managed OIDC tenant, if suitable. | Least new procurement; existing staff lifecycle. | None confirmed yet; must verify code/PKCE and assurance/configuration support. |
| B — Approve a new dedicated managed OIDC service after bounded fit/cost review. | Separate ProjectX lifecycle and test tenant. | Procurement/recurring cost and new operations. |
| C — Use managed enterprise federation through an owner-approved OIDC broker. | Central staff SSO, local ProjectX authorization retained. | Federation setup/customer dependency; unnecessary if no enterprise need. |
| D — Defer provider choice; specification only, no staff runtime exposure. | No premature spending/configuration. | Blocks authenticated reservation-core delivery. |

HISTORICAL RECOMMENDATION: A if a suitable existing tenant; otherwise B via review.
OWNER SELECTED 1B: Auth0, separate development/staging/production configuration.
Provider policy blocker resolved. Actual tenant/issuer/client/callback/origin/proxy
and secret-provisioning inputs must be established safely for CORE-AUTH-02 before
live integration, never stored as secrets in this document. No tenants purchased
or created here; no credentials needed for this policy record.

### CORE-AUTH-D002 — Session lifetime and concurrent policy

QUESTION: What absolute/idle limits and concurrent-device policy fit staffed venue
terminals? WHY IT MATTERS: unattended-terminal guest-data exposure versus shift
interruptions; server enforcement and test acceptance need concrete values.

| Option | Pros | Cons |
|---|---|---|
| A — 12h absolute / 30m idle; separate concurrent device sessions. | Covers common long shifts with bounded inactivity; devices independent. | Unattended exposure lasts up to 30m; shift patterns still need owner confirmation. |
| B — 8h absolute / 15m idle; separate device sessions. | Shorter unattended exposure. | More reauthentication/shift interruption. |
| C — 24h absolute / 60m idle; separate device sessions. | Few interruptions for extended operations. | Longer stolen/unattended-session exposure. |
| D — 12h absolute / 30m idle; one active session per User. | Bounds simultaneous credentials. | Switching devices interrupts staff; does not make shared accounts acceptable. |

OWNER SELECTED 2A: 12h absolute / 30m idle / multiple sessions allowed. Other options
above remain historical/unselected. Server expiry remains authoritative; background
polling is not interactive activity. No additional timeout values are approved.

### CORE-AUTH-D003 — Privileged assurance/freshness policy

QUESTION: Which verified provider assurance/reauthentication policy and freshness
window may authorize existing high-risk administrative operations? WHY IT MATTERS:
current contracts already require fresh step-up, but provider assurance mapping and
numeric window are unresolved. This is not a new blanket reservation-MVP requirement.

| Option | Pros | Cons |
|---|---|---|
| A — Provider-verified MFA step-up within 5m for existing high-risk operations only. | Narrow strong control; ordinary staff flow unaffected. | Needs confirmed MFA/auth_time support and admin reauthentication. |
| B — Fresh provider reauthentication for every privileged operation. | Clear per-operation freshness consistent with existing reauth alternative. | More prompts; baseline provider authentication may be weaker than MFA. |
| C — MFA at every staff login plus fresh <=5m MFA for high-risk operations. | Stronger staff-session baseline. | Adds routine staff friction/enrollment; owner product/security choice. |
| D — Deny/defer privileged mutations until scoped assurance policy is approved. | Safe bounded ordinary staff delivery without fake assurance. | Administrative writes cannot be exposed through new integration. |

OWNER SELECTED 3A: Targeted high-risk MFA/recent privileged assurance with freshness
approximately 5 minutes. This owner wording governs the policy; original option
table wording is history, not an additional exact timeout. Auth0 implementation
mechanics remain future design/tests. Privileged exposure fails closed without
verified assurance; ordinary reservations need no repeated step-up. No Export or
full administrative redesign belongs to CORE-AUTH-02.

## Completion and next action

CORE-AUTH-01 VERIFIED means documentation validation only. CORE-AUTH-02 — Trusted
staff session integration is now READY after APPROVED D004 resolves D001/D002/D003;
it still requires a separate explicitly scoped implementation prompt and
bootstrap/session security design review. Scope: Auth0 adapter, secure callback,
issuer/subject mapping, restricted server session persistence /
middleware/resolver/pool, CSRF/logout/context validation and focused tests. Exclude
public guest auth, reservation domain, Export, broad People changes, unrelated
settings and generic audit. D003 preserves the privileged exposure gate.

No runtime/production-login readiness or integrated core gate is verified here.
Next exact task: **CORE-AUTH-02 — Trusted staff session integration**. Local documentation commit
only; separate exact-SHA publication approval required. Do not start CORE-AUTH-02
or any deferred task automatically.
