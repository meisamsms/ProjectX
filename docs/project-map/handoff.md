CURRENT PHASE: PHASE-04 — IN_PROGRESS.
CURRENT TASK: RESERVATION-DOMAIN-007 — Public Guest Booking Backend & PostgreSQL Security Slice (ADR-0023 Package A).
STATUS: IMPLEMENTED — all automated gates PASS; one local commit made. VERIFIED pending independent QA and security-review subagent sign-off (quota blocked, resets ~168h from 2026-10-31T03:28Z). See CHK-091.
BLOCKER: Independent QA subagent (f308cd1f) and security-review subagent (7ec4eeba) both hit RESOURCE_EXHAUSTED 429. Task cannot advance to VERIFIED without these reviews. No self-approval per AGENTS.md Rule 6.
PREVIOUS HANDOFF (historical context; superseded current task fields below):
COMPLETED: Draft captures original revision; search retains draft/version/key; newer record blocks submit with focused warning and explicit reload/review. Actual payload regression tests added. CHK-084 state-vs-version and CHK-086/087 parent-SHA discrepancies reconciled by addenda, preserving originals.
FILES CREATED: None.
FILES MODIFIED: apps/web/src/reservations/page.tsx; apps/web/tests/reservations/book.test.tsx; tests/e2e/reservations-book.spec.ts; docs/project-map/roadmap.json; docs/project-map/verification.json; docs/project-map/handoff.md.
TESTS EXECUTED: Focused Vitest; focused Playwright; pnpm verify; pnpm verify:db; pnpm map:check; git diff --check; historical object/parent comparison.
TEST RESULTS: Focused 19/19 (17 reservation + 2 shell); browser 10/10 with axe; verify PASS 299 (4 unit + 56 auth + 19 integration + 178 web + 42 E2E), API/web builds PASS; database 280/280 across 23 files on disposable PostgreSQL16.15. The 17 reservation component tests run separately from existing test:web selector. Initial regression failure, sandbox ENOENT and StrictMode fixture correction retained in CHK-090.
UNRESOLVED ISSUES: No remaining material regression identified in reviewed scope. Publication approval and exact-SHA CI pending; public/live integrated core readiness remains unmet.
TASK ID: DOMAIN-005-REGRESSION-001.
PRIORITY PART: 1.
CORE WORKFLOW ADVANCED: Safe concurrent staff reservation modification.
DEPENDENCIES AND THEIR VERIFIED STATUS: DOMAIN-001..006 remain recorded VERIFIED within their bounded scopes; specific DOMAIN-005 correction verified by CHK-090.
WHY THIS TASK IS REQUIRED NOW: Owner-authorized correction of publication-blocking stale draft overwrite.
OWNED SCOPE AND EXCLUDED SCOPE: Editor, focused tests, evidence/roadmap/handoff only; no backend, migrations, public access or infrastructure.
ACCEPTANCE CRITERIA: Original version context retained; stale submit blocked; explicit reload required; unchanged retry payload and normal modification/cancel/list preserved — PASS.
VERIFICATION COMMANDS: Focused component/browser commands and full gates recorded in CHK-090.
REGRESSION CHECKS: All 87 old check objects and 67 prior task objects unchanged; original four commits and parents intact; security boundaries unchanged.
DECISION: VERIFIED; prepare exact local final SHA for owner publication approval.
CORE READINESS GATE: unmet; no production readiness claim.
REQUIRED FOUNDATION DEPENDENCIES: Existing trusted staff context, permissions, RLS/runtime, transaction/version/idempotency and audit boundaries preserved.
DEFERRED SECONDARY TASKS AND REASONS: P3 remains deferred under PRIORITY-D001 until core readiness gate passes.
NEXT EXACT TASK: Owner approval of exact final local SHA for five-commit chain publication; then exact-SHA GitHub CI. No push authorized here.
NEXT EXACT CORE TASK OR REQUIRED PREDECESSOR: DOMAIN-007 requires separate explicit implementation authorization.
FILES NEXT AGENT MUST READ: AGENTS.md; this handoff; CHK-090 addenda (CHK-084/086/087); roadmap.json; ADR-0020/0022/0023; editor and focused tests.
GIT BASE: c42557a02fe21d94b7e67fb3eb9cd54bb60fd8e2. Remote base remains 9a4c9db200a58d47848e3a6dc0a019a89d68851c. Original DOMAIN-003..006 chain unchanged.
LOCAL COMMIT: fix(reservations): prevent stale draft overwrite after refresh — single child of DOMAIN-006 after verification; resolve exact SHA from Git.
CLEANUP: Exact task container eeee40bb8f90c24bef880a89bc4fe3a9271697fab96f3a954154b4abd4e759d9 stopped and removed; tmpfs synthetic data discarded; no shared/production database used.
SKILLS / AGENTS: No specialized skills applied; one primary Codex agent, no delegation. No required capability currently unavailable; earlier approval-review usage-limit interruption resolved on resume.
DOMAIN-007 HANDOFF:
FILES CREATED: apps/api/migrations/zz-reservation-domain/20261027001300_public_guest_booking.sql; apps/api/src/reservations/public-route.ts; apps/api/tests/reservations/public-http.test.ts.
FILES MODIFIED: apps/api/src/reservations/service.ts; apps/api/src/app.ts; packages/contracts/openapi.json; packages/contracts/generated/api.ts; tooling/db-test.mjs; docs/architecture/ADR-0023-public-guest-booking-boundary.md; docs/data/reservation-domain.md; apps/api/tests/people/booked-by.test.ts; apps/api/tests/people/direct-grants-migrations.test.ts; apps/api/tests/people/rls-migrations.test.ts; apps/api/tests/people/roster-fields-migrations.test.ts; apps/api/tests/people/server-names.test.ts; apps/api/tests/reservations/domain.test.ts; docs/project-map/roadmap.json; docs/project-map/verification.json; docs/project-map/handoff.md.
TESTS EXECUTED: pnpm verify:db (25 files/292 tests PASS, PostgreSQL 16 disposable container 127.0.0.1:55432); focused public-http.test.ts 10/10; pnpm verify (42/42 E2E, 178 web, 56 auth, 19 integration, 4 unit); pnpm contract:check; pnpm map:check; git diff --check.
TEST RESULTS: All PASS. verify:db 292/292; public-http 10/10; E2E 42/42; total verify suite PASS.
REMAINING BLOCKER: Independent QA and security-review subagents quota-blocked (429, resets ~168h). Task is IMPLEMENTED; advances to VERIFIED on review completion.
NEXT EXACT TASK: Complete independent review when quota resets, then mark CHK-091 and DOMAIN-007 VERIFIED. Then owner authorization for RESERVATION-DOMAIN-008 (SCR-072 public widget UI).
CLEANUP: Disposable test container projectx-reservation-domain-007-test (postgres:16, 127.0.0.1:55432) may still be running; stop/remove when reviews complete.
LOCAL COMMIT: feat(reservations): DOMAIN-007 public guest booking backend (ADR-0023, CHK-091) — child of fd69dd3.
