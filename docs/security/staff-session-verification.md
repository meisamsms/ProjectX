# CORE-AUTH-02 — deterministic verification and deployment boundary

2026-10-05. PROJECTX IMPLEMENTATION EVIDENCE under ADR-0003/0004 and approved
CORE-AUTH-D004. Base 84ed2938d7d1fa6155e744a50ef3d6aebe6f978c.
Parent task IMPLEMENTED; controlled Auth0/production assurance remains NEEDS TESTING.
No SevenRooms evidence or parity claims.

## Owner-approved development target checkpoint — D005 / CHK-061

2026-10-05; documentation base `cf6d4354eec1408a4f004857cdb944978e948c83`.
OWNER APPROVED / PROJECTX DEPLOYMENT DECISION, not executed provisioning or
controlled-provider verification. See authoritative CORE-AUTH-D005 in decisions.json
and the development policy in staff-access-integration.md. CHK-059/060 and all
historical results below are preserved without rewriting their limitations.

Approved 1A–5A: Render DEVELOPMENT; nearest suitable supported US region to
Arkansas, preferring Ohio IF offered at provisioning time; Render-provided HTTPS
hostname initially, custom domain DEFERRED; smallest normal stable paid/development
service/database tier; dedicated ProjectX Auth0 DEVELOPMENT tenant/application.
Ohio and actual region/tier/pricing/PostgreSQL 16 availability remain NEEDS TESTING
in the actual provisioning interface. Material cost/architecture escalation requires
STOP and new owner approval; no production/staging approval or annual commitment.
D004 remains unchanged and authoritative for authentication/session/assurance.

CORE-AUTH-02-ENV-001 remains **BLOCKED**. Owner selection RESOLVED; outstanding:
actual Render resources and availability/cost checks, actual Auth0 development
registration, canonical same-origin HTTPS endpoint/cookie verification, PostgreSQL
target, distinct restricted runtime role, deployment-native secret injection,
synthetic identity binding and sanitized controlled logs/evidence. No resources,
credentials or identities created here, no secret values recorded, no live test.
CORE-AUTH-02 stays IMPLEMENTED; providerVerification NEEDS TESTING, liveAuth0Tested
false. All existing controlled gates and fail-closed assurance boundaries persist.

Next exact task: **CORE-AUTH-02-ENV-001 — Provision approved Render/Auth0 development
environment**. No application code, production resources, Settings, reservations
or Export. Once ENVIRONMENT READY FOR CONTROLLED VERIFICATION: YES is supported by
evidence, resume this existing real-provider matrix, not new authentication code.
SETTINGS-CORE-01 remains PLANNED, blocked pending VERIFIED CORE-AUTH-02.
Documentation commit requires separate exact-SHA publication approval; no push or
provisioning in this approval-recording task. No new SevenRooms evidence/parity claim.

## Deterministic evidence

Focused files:

- O: apps/api/tests/staff-auth/oidc.test.ts (signed RSA fixtures, maintained library,
  controlled JWKS/token transport; not live Auth0).
- H: apps/api/tests/staff-auth/http.test.ts (HTTP guards, cookies, one-use callback,
  secret canaries; injected store/provider).
- D: apps/api/tests/staff-auth/database.test.ts (real PostgreSQL 16.15, restricted
  login, clean/populated upgrade, actual cookie -> People/RLS HTTP path).
- T: apps/api/tests/staff-auth/transaction.test.ts (broken rollback destroys client).
- W: apps/web/tests/staff-auth.test.tsx (minimal continuity, per-tab guard, no replay).
- P: existing People authorization, RLS and direct-grant database regressions.

Each PASS below is deterministic local evidence, not production or provider proof.
The real Auth0 equivalents remain a separate controlled gate. N32 verifies denial
only; a privileged success path is deliberately not exposed.

| ID | Verified negative boundary | Evidence |
|---|---|---|
| AUTH-N01 | Missing session, no module SQL | H |
| AUTH-N02 | Forged credential/hash, no disclosure | H, D |
| AUTH-N03 | Absolute/idle expiry; no polling renewal | D |
| AUTH-N04 | Durable revoked session never resurrected | D |
| AUTH-N05 | Disabled User denied then session unusable | D |
| AUTH-N06 | Revoked membership clears affected scope/version | D |
| AUTH-N07 | Revoked VenueAccess clears selected Venue/version | D |
| AUTH-N08 | Current required capability missing | D, P |
| AUTH-N09 | User/organization/venue/permission headers cannot replace actor | H, D |
| AUTH-N10 | Foreign organization selection | H, D |
| AUTH-N11 | Forged/nonexistent venue selection | H, D |
| AUTH-N12 | Cross-organization venue rejected | D |
| AUTH-N13 | Inaccessible venue not persisted | D |
| AUTH-N14 | Grant revocation is current, not frozen | D, P |
| AUTH-N15 | Tenant/org-only context cleanup and broken rollback | D, T, P |
| AUTH-N16 | Invalid issuer and foreign callback; fixed provider endpoints | O |
| AUTH-N17 | Invalid audience / authorized party | O |
| AUTH-N18 | Expired / future-nbf token | O |
| AUTH-N19 | Invalid RSA signature / unsigned algorithm / unavailable JWKS | O |
| AUTH-N20 | Missing/mismatched state, one-use transaction and expiry | O, H, D |
| AUTH-N21 | Missing/mismatched nonce | O |
| AUTH-N22 | Replayed callback correlation; PKCE sent; invalid_grant denied | O, H, D |
| AUTH-N23 | Missing/wrong CSRF for POST/PUT/PATCH/DELETE | H, W |
| AUTH-N24 | Foreign/null Origin, Host/proxy spoof, Referer fallback | H |
| AUTH-N25 | Logout durable before cookie clear; no reuse | H, D, W |
| AUTH-N26 | Rotation revokes predecessor, concurrent device unaffected | H, D |
| AUTH-N27 | Exact binding, duplicate-pair constraint, no email enrollment | O, D |
| AUTH-N28 | Deleted/rebound identity denies rather than actor substitution | D |
| AUTH-N29 | Current role/direct grant/capability changes | D, P |
| AUTH-N30 | Store unavailable / owner pool / missing production config | O, H, D, W |
| AUTH-N31 | Stale tab/version rejects without wrong-venue replay | H, D, W |
| AUTH-N32 | UNVERIFIED assurance/browser MFA cannot enable Add User | H; controlled MFA success NEEDS TESTING |
| AUTH-N33 | No callback/cookie/verifier/provider/client-secret canaries in logs/output | O, H |
| AUTH-N34 | No direct auth tables / PUBLIC execute / arbitrary actor function / unsafe pool / temp shadow | D |

## Commands and results

Final local results (CHK-059): pnpm verify PASS (unit 4/4, auth 56/56,
integration 19/19, existing web 178/178, browser E2E/axe 32/32, builds PASS).
pnpm verify:db PASS: 210/210 across 21 files, including 27/27 auth database tests
and all 183 existing database/API-contract tests on PostgreSQL 16.15.
Formatting/lint/typecheck/contracts/map checks and frozen install PASS.
Required commands: pnpm format:check; pnpm lint; pnpm typecheck;
pnpm contract:check; pnpm map:check; pnpm test:auth; pnpm verify; pnpm verify:db;
git diff --check. The main gate now includes test:auth, and verify:db includes D
alongside all existing People database files (serial shared disposable schema).
Historical People migration SQL is unchanged; expected ledgers include the new
auth migration with exact checksum, and Server Names tampering is found by name.

The first full database run had 200 PASS / 9 FAIL, all new-ledger compatibility
assertions across five existing test files. No domain/RLS behavior failed.
Those exact ledger expectations were extended; historical checksum/data/RLS
assertions were retained. Initial format and one new tuple TypeScript check failed
and were corrected. The known PEOPLE-06 focus test was not modified.

The second full database run had 209 PASS / 1 FAIL: core-persistence counted a
previous upgrade test's leftover Organization because it lacked a test-schema
reset. Added only the guarded reset before its migrations/fixture suite; all exact
counts and business assertions remain unchanged. No production cleanup added.

Environment: Windows, Node 24.19.0, PostgreSQL 16.15 official portable binaries
in a new disposable cluster bound only to 127.0.0.1:55436, synthetic database ending
_test with TEST_DATABASE=1/NODE_ENV=test. No Windows service or existing database
changed. Test-only owner seeds migrations; actual runtime tests use a separate
non-owner login with random credential and no BYPASSRLS. Test credentials never
reach Git/logs. Existing local Chrome supplies Playwright browser execution;
CI installs its own Chromium. Browser/axe results do not prove WCAG conformance.
Node shell-spawn deprecation, color and React Router directive warnings are
non-blocking maintenance notes, not failed tests.

## Controlled verification precheck — CHK-060, 2026-10-05

Base/published implementation: `8469fd5e21df350e4e6f59c5183ae0c347dbf6f0`;
exact clean HEAD and branch `people-03-accounts-read` confirmed. Existing
[CI run 37378038188](https://github.com/meisamsms/ProjectX/actions/runs/37378038188),
attempt 1 / job 111992282747, SUCCESS: pnpm verify and pnpm verify:db PASS;
PostgreSQL 16.15; auth 56/56, auth DB 27/27, all DB 210/210 across 21 files.
This is CONFIRMED exact-SHA CI evidence, not controlled provider/deployment proof.
CHK-059 and earlier results remain historical and unchanged; no rerun requested.

**CONTROLLED AUTH0 VERIFICATION = BLOCKED BY ENVIRONMENT SETUP.**
Presence-only checks found all seven required inputs unavailable in Process,
User and Machine environments: AUTH0_ISSUER, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET,
AUTH0_CALLBACK_URI, AUTH0_POST_LOGOUT_URI, STAFF_APP_ORIGIN and
STAFF_RUNTIME_DATABASE_URL. STAFF_AUTH_ENABLED and VITE_STAFF_AUTH_ENABLED are
also absent. No root/API/web `.env` or `.env.local` file exists at the six checked
conventional paths. These are CONFIRMED local-session findings, not proof that no
external tenant/deployment exists. No approved HTTPS endpoint, registration
settings, mapped test issuer/subject/User or development runtime-role evidence
was supplied; their external availability is UNKNOWN.

Live verification stopped at the environment precheck. No tenant/client creation,
configuration change, login, provider discovery, callback, DB connection, test-data
mutation, outage/rotation injection or mock replacement was attempted. No secret
values were printed or committed. No implementation defect established by this
precheck; no code/test/migration/contract change authorized or needed here.

| Controlled gate | Classification / result |
|---|---|
| Auth0 registration: Code/PKCE S256, exact callback/logout/origin/issuer/client/RS256 | UNKNOWN; registration/configuration not accessible |
| HTTPS browser cookie attributes, JavaScript exclusion and HTTP non-use | NEEDS TESTING; no approved HTTPS endpoint |
| Real login/callback, issuer/audience/signature/expiry/state/nonce/PKCE | NEEDS TESTING; not executed |
| Exact issuer/subject mapping, unknown binding/disabled denial, no email linking | NEEDS TESTING with real provider/test identity |
| Membership/VenueAccess/User revocation and Venue/context/version boundaries | NEEDS TESTING with real session and controlled test data |
| Rotation, absolute/idle expiry, no GET renewal, durable logout/no reuse | NEEDS TESTING in controlled deployment; 12h/30m/multiple policy unchanged |
| Callback negative cases, JWKS, key rotation and provider outage | NEEDS TESTING; no safe configured environment to induce cases |
| Multi-instance session/revocation | NEEDS TESTING; no two approved instances available |
| CSRF and Origin/Host with authenticated browser | NEEDS TESTING; not executed |
| Auth0 MFA/auth_time/recent assurance and privileged success | NEEDS TESTING; high-risk writes remain fail-closed |
| Ordinary core operations without blanket repeated step-up | NEEDS TESTING with real provider/core consumer; no reservation implementation or exemption proof |
| Deployed migration/runtime role/RLS/grants/TLS/pool isolation | NEEDS TESTING; no approved deployment database configuration |
| Controlled application/gateway/provider secret-free logs | NEEDS TESTING; no controlled logs available; local presence checks expose no values |

CORE-AUTH-02 remains IMPLEMENTED; providerVerification.status NEEDS TESTING and
liveAuth0Tested false. Positive privileged assurance is not verified. The owner
prompt permits a fail-closed privileged-exposure alternative only with controlled
proof that required ordinary reservation-core operations remain usable; that proof
is absent here. No production Auth0 or integrated core readiness claim is made.

Required predecessor (CORE-AUTH-02-ENV-001): owner/admin securely provision the
approved development registration/configuration outside Git, canonical HTTPS
gateway/endpoint, pre-existing exact test identity binding and restricted runtime
database/role/TLS evidence, plus access to sanitized controlled logs. Do not paste
secrets into chat/docs or use migration-owner credentials for app requests. No new
product/architecture choice is required. Resume the controlled matrix only after
these inputs are available; do not start SETTINGS-CORE-01, reservations or Export.
This task records documentation locally only; separate exact-SHA approval is
required to publish it.

## Original implementation deployment/provider checklist — historical

The six items below are the original CHK-059 checklist. Publication item 6 is now
satisfied by the CI evidence above; provider/deployment items remain NEEDS TESTING.

1. Separate Auth0 confidential web-client registrations for dev/staging/production;
   exact HTTPS issuer, client ID/audience, callback/logout allowlists, RS256 and
   token-endpoint client_secret_post + Code/PKCE supported. Secrets injected outside
   Git; provision pre-existing exact issuer/subject binding without email linking.
2. Reviewed migration/provisioning procedure for existing projectx_test schema;
   scoped runtime role membership and no owner/assumable elevated/global roles;
   verified database TLS/credential handling, production storage/retention and
   deployment health. Test runner is not a production migration tool.
3. Canonical same-origin HTTPS gateway preserves configured Host, strips
   X-Forwarded-Host and exposes no permissive credentialed CORS; secure cookies work
   in a real browser; VITE_STAFF_AUTH_ENABLED=1. Verify access-log redaction at the
   gateway/provider too. Auth events never constitute durable domain audit.
4. Live Auth0 login/callback, bad/reused code/state/nonce/PKCE, issuer/audience/key
   rotation/outage and exact binding; cookie fixation/rotation, multi-instance
   consume/revoke, local logout, 12h/30m expiry and current access revocation.
   Local logout is not federated/global Auth0 logout.
5. Auth0 MFA/auth_time/reauth claim provenance and approximately-five-minute
   freshness. Privileged success remains denied until independently proven and
   separately scoped exposure is authorized; ordinary operations stay ungated
   by repeated MFA. Never interpret browser MFA flags as assurance.
6. Separate exact-SHA approval to push this local implementation, then final
   branch-head CI pnpm verify + verify:db on PostgreSQL 16. No push in this task.

No new owner product/architecture decision required. SETTINGS-CORE-01 still awaits
VERIFIED CORE-AUTH-02; no core readiness or Export scheduling advancement.
