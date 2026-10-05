# CORE-AUTH-02 — narrow staff bootstrap/session access review

2026-10-05. PROJECTX IMPLEMENTATION DESIGN under ADR-0003/0004 and approved
CORE-AUTH-D004; no new identity service, owner policy or reference evidence.

TASK ID: CORE-AUTH-02. PRIORITY PART: 2 REQUIRED FOUNDATION.
CORE WORKFLOW ADVANCED: SETTINGS-CORE-01 authenticated Venue settings, then
RESERVATIONS-CORE-01 staff book/check-in/seating. Dependencies CORE-AUTH-01 and
PEOPLE-CORE-01 VERIFIED in their existing scopes. DECISION: PROCEED with bounded
implementation slices; no Export, guest auth, reservation domain or generic audit.

## Repository findings

CONFIRMED: `authenticated_identities` uniquely binds exact issuer/subject to User.
People identity SELECT requires SELF capability/GUCs; it cannot bootstrap an
anonymous login. Existing restricted runtime functions check current capabilities
but do not store login transactions or sessions. Startup has no runtime pool.
Existing migrations/test runner install `projectx_test`; this is an existing
schema convention, not evidence of a production migration/deployment process.

## Owned persistence/access design

New auth-owned login transactions and staff sessions have no runtime direct table
SELECT/INSERT/UPDATE/DELETE grants; RLS is enabled with default deny. A new NOLOGIN,
non-owner, non-superuser, NOBYPASSRLS auth runtime role receives EXECUTE only on
enumerated auth functions. The deployment login may inherit it and the existing
People runtime role. No migration/admin connection is used for requests.

Every privileged function has a fixed `pg_catalog, projectx_test, pg_temp` path,
schema-qualified references, bounded arguments and PUBLIC EXECUTE revoked. No
dynamic SQL, arbitrary table/event/actor query or generic privileged gateway.
Internal own-context enumeration is not granted to runtime: it is reachable only
through a live unguessable session verifier, and returns this actor's active
membership/access choices, never roster/profile/permission graph data.

Login creation/consume is correlated to a random browser credential and atomically
one-use; nonce/PKCE values are not readable through ordinary table access. Session
issuance accepts an exact issuer/subject only from the trusted server OIDC adapter
after signature/issuer/audience/expiry/state/nonce/PKCE checks. Database EXECUTE
authority is a trusted application boundary, not independent OIDC verification;
SQL-credential compromise is not claimed to be harmless. Browser inputs never
reach this issuance function as identity authority. No email linking or enrollment.

Store only SHA-256 verifiers of random 256-bit cookie secrets. Sessions retain
identity binding snapshots so deleted/rebound identities fail closed, current User
state, database-enforced 12h absolute/30m idle bounds, revocation and selected
Org/Venue/context version. No provider token or long-lived grants retained.
Own-context choices do not grant capabilities; existing People transaction/RLS
checks remain mandatory. Atomically validate/switch context and reject stale-tab
mutation versions. No silent Venue fallback after revocation.

Privileged assurance is unverified until controlled Auth0 evidence exists;
high-risk administration stays denied. Safe structured event logging is not
durable audit. PEOPLE-D010 remains export-only/deferred and is not reused.

## Verification/exposure gates

CONFIRMED integration dependency: the shared migration runner installs every
forward migration. Five existing People migration tests assert the entire ledger,
and one Server Names test assumes its migration is last. The first full database
gate failed nine assertions solely on the new auth ledger entry (200 tests passed).
CORE-AUTH-02 owns extending those exact expected lists with the new auth checksum
and selecting the tampered Server Names entry by stable name. Historical migration
SQL, checksum assertions, upgrade prefixes, RLS and behavior checks stay intact;
this is required test compatibility, not People domain implementation/refactoring.

CONFIRMED shared-test isolation gap: after those corrections, the second complete
run passed 209 tests and failed one core fixture count because a prior upgrade
test left an Organization row and core-persistence only ran migrations, not reset.
The expanded suite changed file sequencing. CORE-AUTH-02 owns adding the guarded
test-schema reset before that fixture suite; its exact counts/assertions remain
unchanged. No runtime data cleanup or production schema operation is added.

Required deterministic checks: real PostgreSQL 16 clean/upgrade migration, SQL
grants/PUBLIC execute/search-path shadowing, unauthorized table access, invalid
credential/mapping/disabled state, concurrent consume/rotation/revocation/context
switch/expiry and pool cleanup; deterministic OIDC/JWKS and HTTP/CSRF/secret canary
tests; prior People regressions. Executed commands/evidence and provider limitations
are recorded in `staff-session-verification.md` and CHK-059.

Startup must reject owners/superusers/BYPASSRLS/broad roles and missing auth config.
Actual Auth0 registrations, HTTPS same-origin gateway and controlled IdP/assurance
verification remain deployment gates. No production verification from mocks.

Use maintained [openid-client](https://github.com/panva/openid-client) Code flow
checks and explicitly enable its
[JWS signature checks](https://github.com/panva/openid-client/blob/main/docs/functions/enableNonRepudiationChecks.md),
which are not implied by a TLS token exchange. No handwritten JWT verifier.
