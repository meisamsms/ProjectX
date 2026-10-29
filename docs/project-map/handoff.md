CURRENT PHASE: PHASE-04 — IN_PROGRESS.
CURRENT TASK: DOMAIN-005-REGRESSION-001.
STATUS: VERIFIED under CHK-090; local commit only, no push.
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
