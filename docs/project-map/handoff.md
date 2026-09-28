CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: PEOPLE-01 — People core persistence and domain contracts.
STATUS: VERIFIED — GitHub Actions run 36487404857, job 109147542616, PostgreSQL 16.15.
COMPLETED: Six-table migration, UUIDv7 generator, synthetic ORG-A/A1/A2 and ORG-B/B1 fixture graph, positive/negative PostgreSQL constraints, clean migration/checksum/repeatability tests; no RLS or runtime exposure.
FILES CREATED: apps/api/migrations/people-core/20260928000100_people_core.sql; apps/api/src/people/persistence/id.ts; apps/api/tests/people/fixtures/core.ts; apps/api/tests/people/core-persistence.test.ts; apps/api/tests/people/migrations.test.ts; docs/data/people-core-persistence.md.
FILES MODIFIED: tooling/db-test.mjs; docs/project-map/roadmap.json; verification.json; handoff.md.
TESTS EXECUTED: pnpm format:check; pnpm lint; pnpm typecheck; pnpm map:check; local pnpm verify with Chromium; CI pnpm verify and pnpm verify:db with PostgreSQL 16.15.
TEST RESULTS: CI foundation and database gates PASS; 4 database suites, 9 tests PASS, including 5 core and 1 migration test. Cross-Organization composite FKs, identity uniqueness, active duplicates and invalid FKs rejected by PostgreSQL.
UNRESOLVED ISSUES: U-002 alternate-role reference permissions and FLOW-006 create outcomes remain UNKNOWN. No claim about reference internal schema; RLS and authorization are PEOPLE-02, grants PEOPLE-01B.
NEXT EXACT TASK: PEOPLE-01B — Role, Permission and scoped grant persistence. Do not execute as part of PEOPLE-01.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/{roadmap.json,verification.json,handoff.md,people-implementation-plan.md}; docs/security/permission-registry.json; docs/data/people-core-persistence.md; PEOPLE-01 migration and tests.
