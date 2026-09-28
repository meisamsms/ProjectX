CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: PEOPLE-01B — People role and permission persistence.
STATUS: VERIFIED — GitHub Actions run 36491895677, job 109162226378, PostgreSQL 16.15. PEOPLE-02 READY and not started.
COMPLETED: Forward migration with all 22 registered permissions, organization-owned Roles, explicit RolePermission mapping, separate scoped grants, composite ownership/scope constraints, active-parent insertion/reactivation triggers, independent grant revocation/version, synthetic grant and clean/PEOPLE-01 upgrade tests.
FILES CREATED: apps/api/migrations/people-grants/20260928000200_people_grants.sql; apps/api/tests/people/grants.test.ts; grants-migrations.test.ts; docs/data/people-grants-persistence.md.
FILES MODIFIED: apps/api/tests/people/migrations.test.ts; tooling/db-test.mjs; docs/project-map/people-implementation-plan.md; roadmap.json; verification.json; handoff.md.
TESTS EXECUTED: local pnpm format:check, lint, typecheck, map:check, pnpm verify with Chromium; CI pnpm verify and pnpm verify:db against PostgreSQL 16.15.
TEST RESULTS: PASS, six database files, 17 tests including six grant and two grant-migration tests. Initial CI run 36491659521 failed two expected SQLSTATE assertions; corrected trigger/check precedence and reran successfully. No audit runtime claimed.
UNRESOLVED ISSUES: U-002 alternate-role reference behavior UNKNOWN / REQUIRES_OTHER_ROLE; FLOW-006 outcomes unknown. Durable grant audit, RLS and runtime authorization remain downstream. Schema is ProjectX implementation, not reference internals.
NEXT EXACT TASK: PEOPLE-02 — People authorization, tenant isolation and RLS. Do not execute as part of PEOPLE-01B.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/{roadmap.json,verification.json,handoff.md,people-implementation-plan.md}; docs/security/{permission-registry.json,authorization-contract.md}; docs/data/{people-core-persistence.md,people-grants-persistence.md,rls-policy-model.md}; PEOPLE-01 and PEOPLE-01B migrations and tests.
