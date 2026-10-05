# CORE-AUTH-02 — deterministic verification and deployment boundary

2026-10-05. PROJECTX IMPLEMENTATION EVIDENCE under ADR-0003/0004 and approved
CORE-AUTH-D004. Base 84ed2938d7d1fa6155e744a50ef3d6aebe6f978c.
Parent task IMPLEMENTED; controlled Auth0/production assurance remains NEEDS TESTING.
No SevenRooms evidence or parity claims.

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

## Controlled deployment/provider gates — NEEDS TESTING

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
