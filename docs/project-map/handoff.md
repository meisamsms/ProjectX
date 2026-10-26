CURRENT PHASE: PHASE-04 — Core domain implementation, IN_PROGRESS.
CURRENT TASK: RESERVATION-DOMAIN-004 — Authenticated Staff Reservation HTTP API.
STATUS: VERIFIED under CHK-085.
COMPLETED: Verified starting HEAD 228d99e689c2b25260fe8bf838f9a612433b4dd8 on branch people-03-accounts-read. Implemented authenticated staff HTTP endpoints under /api/v1/staff/reservations (availability search, create, get, list, modify, check-in, seat, cancel) in apps/api/src/reservations/route.ts, wired into apps/api/src/staff-auth/routes.ts and apps/api/src/app.ts, updated packages/contracts/openapi.json and packages/contracts/generated/api.ts, and verified against disposable PostgreSQL 16.15.
FILES CREATED: apps/api/src/reservations/route.ts, apps/api/tests/reservations/http.test.ts, docs/architecture/ADR-0021-staff-reservation-http-api.md (ACCEPTED).
FILES MODIFIED: apps/api/src/staff-auth/routes.ts, apps/api/src/app.ts, packages/contracts/openapi.json, packages/contracts/generated/api.ts, tooling/db-test.mjs, docs/data/reservation-domain.md, docs/project-map/roadmap.json, docs/project-map/verification.json, docs/project-map/handoff.md.
TESTS EXECUTED: pnpm contract:check; pnpm db:check; focused Staff Reservation HTTP integration suite apps/api/tests/reservations/http.test.ts (8/8); pnpm verify:db (280/280 across 23 files); pnpm verify (unit 4/4, auth 56/56, integration 19/19, web 178/178, E2E 32/32, API/web builds); pnpm map:check; git diff --check.
TEST RESULTS: All gates PASS on disposable PostgreSQL 16.15; recorded in CHK-085.
UNRESOLVED ISSUES: CORE-READY-01 remains UNMET. Live staff authentication provider/transport gates (CORE-AUTH-02), Venue reservation settings (SETTINGS-CORE-01), staff browser reservation UI, public guest widget endpoints and confirmation delivery remain separate tasks.
PRIORITY PART: 1.
CORE WORKFLOW ADVANCED: Authenticated staff HTTP availability search, reservation creation, retrieval, listing, modification, check-in, seating and cancellation under server-derived Organization/Venue scope with CSRF, Origin/Host and context-version protections.
CORE READINESS GATE: unmet; DOMAIN-001/002/003/004 are verified internal and staff-API slices; public/browser/live-provider gates unchanged.
REQUIRED FOUNDATION DEPENDENCIES: DOMAIN-001, DOMAIN-002, DOMAIN-003, PEOPLE-CORE-01 and DB-HARNESS-001 VERIFIED.
DEFERRED SECONDARY TASKS AND REASONS: P3 export/reporting remains deferred under PRIORITY-D001; no infrastructure work; budget $0.
TASK ID: RESERVATION-DOMAIN-004.
DEPENDENCIES AND THEIR VERIFIED STATUS: RESERVATION-DOMAIN-001 (VERIFIED), RESERVATION-DOMAIN-002 (VERIFIED), RESERVATION-DOMAIN-003 (VERIFIED), PEOPLE-CORE-01 (VERIFIED), DB-HARNESS-001 (VERIFIED).
WHY THIS TASK IS REQUIRED NOW: Owner-authorized nonproduction P1 implementation of the authenticated Staff Reservation HTTP API on the verified reservation domain and local staff-auth middleware.
OWNED SCOPE AND EXCLUDED SCOPE: Staff reservation HTTP route module, staff-auth prefix guard, app registration, OpenAPI contract and generated types, focused PostgreSQL 16 HTTP integration tests, ADR/docs, and one local commit. No migrations, no service.ts modifications, no public widget routes, no provider configuration or deployment.
ACCEPTANCE CRITERIA: Valid staff session and Venue scope required; CSRF, Origin/Host and context-version enforced on mutations; granular reservation permissions and Venue isolation enforced; idempotency, revision checks and capacity protection preserved; safe error mapping without SQL/PII leakage; all verification gates pass.
VERIFICATION COMMANDS: pnpm contract:check; pnpm db:check; pnpm exec vitest run apps/api/tests/reservations/http.test.ts --no-file-parallelism --reporter=verbose; pnpm verify:db; pnpm verify; pnpm map:check; git diff --check, on disposable PostgreSQL 16 only.
REGRESSION CHECKS: All 84 prior checks (CHK-001..CHK-084) and all 29 previously VERIFIED task objects, historical migrations and internal reservation service preserved; all 62 prior reservation domain tests preserved alongside 8 new HTTP integration tests.
DECISION: VERIFIED; bounded implementation and verification complete. Stop after one local logical commit; do not push or start another task automatically.
NEXT EXACT TASK: Await separate owner authorization for the next dependency-ready Part 1/Part 2 core task (e.g., staff reservation browser UI integration, SETTINGS-CORE-01, or WIDGET-CORE-01 public contract). Do not start automatically.
NEXT EXACT CORE TASK OR REQUIRED PREDECESSOR: Staff reservation UI slice or Venue reservation settings contract after explicit owner authorization.
FILES NEXT AGENT MUST READ: AGENTS.md; ADR-0018/0019/0020/0021; docs/data/reservation-domain.md; apps/api/src/reservations/service.ts; apps/api/src/reservations/route.ts; docs/project-map/roadmap.json; docs/project-map/verification.json; docs/project-map/handoff.md.
CAPABILITIES: Primary engineering agent plus independent QA/security review subagent verification; bounded-implementation, api-contracts, database-isolation and restaurant-workflows skills applied.
PUBLICATION: One local logical commit created on branch people-03-accounts-read above 228d99e689c2b25260fe8bf838f9a612433b4dd8; NOT pushed. Remote publication requires separate explicit owner approval.
