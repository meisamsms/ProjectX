CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: PEOPLE-01B — People role and permission persistence.
STATUS: BLOCKED — PostgreSQL 16 CI not run; automatic approval review rejected uploading new PEOPLE-01B code to GitHub. PEOPLE-01 remains VERIFIED; PEOPLE-02 remains PLANNED.
COMPLETED: Locally committed forward grants migration with 22 registry permission seeds, organization-owned roles, explicit role-permission mappings, scoped grants, composite tenant/scope keys, active-parent insertion triggers, independent revocation/version fields, synthetic grant and clean/upgrade migration tests. No runtime authorization or RLS.
FILES CREATED: apps/api/migrations/people-grants/20260928000200_people_grants.sql; apps/api/tests/people/grants.test.ts; apps/api/tests/people/grants-migrations.test.ts; docs/data/people-grants-persistence.md.
FILES MODIFIED: apps/api/tests/people/migrations.test.ts; tooling/db-test.mjs; docs/project-map/roadmap.json; verification.json; handoff.md.
TESTS EXECUTED: pnpm format:check; pnpm lint; pnpm typecheck; pnpm map:check; local pnpm verify with Chromium. No real PostgreSQL execution for PEOPLE-01B.
TEST RESULTS: Local foundation checks PASS. PostgreSQL constraint/migration tests require CI and remain NOT RUN. GitHub branch exists at verified PEOPLE-01 commit; no PEOPLE-01B payload pushed.
UNRESOLVED ISSUES: U-002 alternate-role reference behavior UNKNOWN / REQUIRES_OTHER_ROLE. Durable grant audit and runtime permission/object checks remain for PEOPLE-02 or later access path. Remote publication of this task needs explicit approval because automatic review rejected it.
NEXT EXACT TASK: With explicit approval for the new PEOPLE-01B payload, publish people-01b-grants to meisamsms/ProjectX, inspect PostgreSQL 16 CI, fix only PEOPLE-01B failures, then mark VERIFIED only if all gates pass. Do not execute PEOPLE-02.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/{roadmap.json,verification.json,handoff.md,people-implementation-plan.md}; docs/security/permission-registry.json; docs/data/people-grants-persistence.md; PEOPLE-01 and PEOPLE-01B migrations and tests.
