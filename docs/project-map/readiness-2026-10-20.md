# Project readiness review — 2026-10-20

Review scope: existing repository connections, task dependencies, and runnable verification. Documentation changes only; existing application work preserved. Evidence: CHK-080. Starting HEAD: `cba6905`, branch `people-03-accounts-read`, with pre-existing uncommitted reservation work.

## Assessment

The project can continue with the bounded internal reservation slice. It is not yet an integrated, usable online reservation application. `CORE-READY-01` remains unmet. No application code, migrations, test logic, approved architecture decisions, or reference-app classifications were changed by this review.

| Area | Finding | Evidence / limitation |
| --- | --- | --- |
| Toolchain | CONFIRMED Node 24.19.0 / pnpm 11.25.0 match repository requirements | Root package.json; local checks |
| Web/API/contracts | CONFIRMED React shell, Fastify API, typed OpenAPI and People routes exist | apps/web/src/shell.tsx; apps/api/src/app.ts; packages/contracts/openapi.json |
| Staff authentication | CONFIRMED runtime wiring exists; real provider behavior NEEDS TESTING | main.ts connects OIDC/store/restricted pool; CORE-AUTH-02 remains IMPLEMENTED; CHK-079 transport blockers preserved |
| Local frontend connection | CONFIRMED Vite has no API proxy and staff UI is opt-in | apps/web/vite.config.ts; apps/web/src/main.tsx. Running Vite alone is not a live authenticated application |
| Reservation domain | CONFIRMED internal search/create/read/list/cancel implementation and migration/tests exist; database behavior NEEDS TESTING | apps/api/src/reservations/service.ts; ADR-0018; migration in zz-reservation-domain; focused PostgreSQL suite |
| Reservation API/UI | CONFIRMED absent from current registrations/rendering | No reservation path in OpenAPI or createApp; service imported only by its test. Reservation screens render the placeholder. This matches ADR-0018's bounded scope |
| Database test wiring | CONFIRMED existing uncommitted db-test.mjs registers domain.test.ts | verify:db runs migration then serialized database suites; migration loader discovers sorted SQL directories |
| Integrated browser proof | CONFIRMED existing E2E tests target shell/People with intercepted synthetic API responses | tests/e2e. They do not prove browser → live API → PostgreSQL or real OIDC/confirmation delivery |
| Repository continuity | CONFIRMED stale handoff/next task and missing domain execution-order entry | Reconciled in this review; task IDs, statuses, dependencies, acceptance criteria and prior evidence preserved |
| Data documentation | CONFIRMED ADR-0018 promises physical entity recording, but entity-registry.json contains no reservation physical table mapping | Reconcile before closing RESERVATION-DOMAIN-001; no fabricated persistence verification |

## Current verification

`pnpm verify` **PASS** on the approved outside-sandbox rerun: environment, format, lint, typecheck, OpenAPI validity/generated freshness, map checks (144 screens / 16 modules / 60 tasks), 4 unit + 56 authentication + 19 API integration + 178 web tests, 32 browser tests including accessibility checks, and API/web builds. This is 289 passing tests across these suites. Non-blocking Node shell deprecation, terminal color and React Router bundle-directive warnings were observed.

Initial sandbox `pnpm verify` passed environment/format/lint/types/unit checks, then failed importing an authentication test module from a disappearing sandbox temporary file. The approved outside-sandbox rerun is recorded separately in CHK-080; the first failure is retained rather than hidden.

`pnpm verify:db` failed its environment guard: `DATABASE_URL is required for real PostgreSQL database tests`. No migrations or database assertions ran. The current shell exposes no DATABASE_URL/TEST_DATABASE; Docker CLI is installed but its Linux-engine named pipe is absent. No test database was provisioned and no existing database was reset. Local reservation concurrency, RLS, rollback, timezone/DST and migration behavior remain NEEDS TESTING. Historical database passes do not cover this uncommitted slice.

## Unresolved questions and next work

1. **NEEDS TESTING — RESERVATION-DOMAIN-001:** provide an isolated PostgreSQL 16 test environment and run the existing focused suite and full database gate. Preserve the existing uncommitted work and investigate failures within this slice under an explicit implementation prompt.
2. **CONFIRMED documentation gap — RESERVATION-DOMAIN-001:** map the six physical reservation tables to the independent entity model, retaining reference confidence and existing stable IDs.
3. **NEEDS TESTING — CORE-AUTH-02 / LOCAL-004-PACKAGE-001:** retain the existing portable-package, trusted localhost HTTPS, gateway authority, Auth0 and restricted deployed-database verification boundaries. No transport acquisition, trust changes, provisioning, or real login was authorized or performed in this review.
4. **CONFIRMED incomplete — CORE-READY-01:** public guest search/booking, staff browser book, modification/check-in/seating, guest access controls and actual confirmation delivery remain separate downstream work. Internal tests cannot satisfy these gates.
5. **UNKNOWN — publication:** existing working changes are uncommitted; no current exact-content CI result was retrieved. No commit or push was performed.

Next exact task: complete **RESERVATION-DOMAIN-001 verification and documentation**, with VERIFIED DB-HARNESS-001 and PEOPLE-CORE-01 as its recorded predecessors. Acceptance remains its existing ADR-0018/roadmap criteria: real PostgreSQL 16 search → create → staff read → cancel → capacity restored; concurrency/idempotency, tenant/venue permissions/RLS, rollback/audit, timezone/DST and migration checks; full regressions pass with evidence. Do not add HTTP/UI/public access or broaden the slice while closing it.

Commands once an isolated test environment is available:

```text
pnpm db:check
pnpm db:migrate:test
pnpm exec vitest run apps/api/tests/reservations/domain.test.ts --no-file-parallelism
pnpm verify:db
pnpm verify
pnpm map:check
git diff --check
```

The direct Vitest command requires NODE_ENV=test, TEST_DATABASE=1 and the guarded test DATABASE_URL. The database wrapper sets NODE_ENV=test itself. Use only a disposable `_test` database because fixtures reset its test schema.

PRIORITY-D001 already records reservation-first delivery; no duplicate decision or new ADR was needed. PEOPLE-D010 remains an accepted export-only design, independent of the reservation audit trigger in ADR-0018. PEOPLE-09/09B/10 and other Part 3 work remain deferred until CORE-READY-01 passes or an explicit owner exception is recorded.
