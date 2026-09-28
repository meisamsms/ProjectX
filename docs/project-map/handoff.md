CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: DB-HARNESS-001 — Disposable PostgreSQL test runtime and database verification harness.
STATUS: IN_PROGRESS — awaiting inspected PostgreSQL CI run.
COMPLETED: PostgreSQL 16 CI service, test-only DATABASE_URL guard, pg driver, bounded pool, transactional SQL migration test seam, reset utility, smoke/rollback/reuse tests, separate verify:db command; no People code.
FILES CREATED: apps/api/tests/database/harness.ts; postgres-runtime.test.ts; transaction.test.ts; migrate.ts; apps/api/migrations/.gitkeep; tooling/db-check.mjs; db-test.mjs; verify-db.mjs; docs/foundation/database-test-harness.md.
FILES MODIFIED: .github/workflows/verify.yml; package.json; apps/api/package.json; pnpm-lock.yaml; tooling/verify.mjs; docs/project-map/roadmap.json; verification.json; handoff.md.
TESTS EXECUTED: pnpm format:check; pnpm lint; pnpm typecheck; pnpm map:check; pnpm db:check without URL; PROJECTX_CHROMIUM_PATH=/tmp/projectx-chromium/chromium pnpm verify.
TEST RESULTS: Non-database gates PASS; db:check fails clearly without URL as designed. Real PostgreSQL CI result PENDING; do not claim database PASS.
UNRESOLVED ISSUES: Inspect CI database run. PEOPLE-01 BLOCKED pending DB-HARNESS-001 VERIFIED; PEOPLE-01B PLANNED.
NEXT EXACT TASK: Inspect GitHub Actions run for DB-HARNESS-001 and fix harness-only failures; if all real PostgreSQL gates pass, set DB-HARNESS-001 VERIFIED and PEOPLE-01 READY. Do not execute PEOPLE-01.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/roadmap.json; verification.json; handoff.md; docs/foundation/database-test-harness.md; .github/workflows/verify.yml; apps/api/tests/database/*; tooling/verify-db.mjs.
