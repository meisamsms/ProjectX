CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: PEOPLE-01 — People core persistence and domain contracts.
STATUS: BLOCKED pending PostgreSQL 16 CI and approval to push ProjectX branch.
COMPLETED: Locally committed six-table migration, UUIDv7 ID generator, synthetic ORG-A/A1/A2 and ORG-B/B1 fixtures, positive/negative constraint tests, migration ledger tests; database test command includes People suites serially. No RLS, grants, API or UI.
FILES CREATED: apps/api/migrations/people-core/20260928000100_people_core.sql; apps/api/src/people/persistence/id.ts; apps/api/tests/people/fixtures/core.ts; apps/api/tests/people/core-persistence.test.ts; apps/api/tests/people/migrations.test.ts.
FILES MODIFIED: tooling/db-test.mjs; docs/project-map/roadmap.json; verification.json; handoff.md; docs/data/people-core-persistence.md.
TESTS EXECUTED: pnpm format:check; pnpm lint; pnpm typecheck; pnpm map:check; PROJECTX_CHROMIUM_PATH=/tmp/projectx-chromium/chromium pnpm verify; pnpm verify:db without DATABASE_URL.
TEST RESULTS: Static/foundation suite PASS. Database gate BLOCKED: no local disposable PostgreSQL URL; push to GitHub rejected by automatic approval review. No constraint or migration behavior reported PASS.
UNRESOLVED ISSUES: U-002 alternate role reference behavior and FLOW-006 outcomes remain unknown. PostgreSQL 16 execution and CI inspection required. Auto-review rejected direct main and review-branch pushes to https://github.com/meisamsms/ProjectX.git as consequential remote export; no further push attempted.
NEXT EXACT TASK: With explicit owner approval to publish the review branch, push local PEOPLE-01 commit, run and inspect PostgreSQL 16 CI, fix failures, then mark VERIFIED only if all gates pass. PEOPLE-01B remains PLANNED.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/{roadmap.json,verification.json,handoff.md,people-implementation-plan.md}; docs/foundation/database-test-harness.md; migration, fixture and focused test files.
