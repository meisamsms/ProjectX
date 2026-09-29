CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: PEOPLE-03P — People account roster field persistence prerequisite.
STATUS: VERIFIED — GitHub Actions run 36512777220, job 109228386133, PostgreSQL 16.15. PEOPLE-03 READY but read API not started; PEOPLE-04/05 PLANNED, PEOPLE-09 BLOCKED, parent IN_PROGRESS.
COMPLETED: Owner-approved nullable User first/last name and nullable OrganizationMembership job title/notification preference. NULL differs from explicit false. Forward migration, clean/PEOPLE-02 upgrade, tri-state, restricted RLS and cross-organization synthetic tests passed. No read API.
FILES CREATED: apps/api/migrations/people-roster-fields/20260928000400_people_roster_fields.sql; apps/api/tests/people/roster-fields-migrations.test.ts; docs/data/people-roster-fields.md.
FILES MODIFIED: apps/api/tests/people/rls-migrations.test.ts; tooling/db-test.mjs; docs/project-map/{roadmap.json,verification.json,handoff.md}.
TESTS EXECUTED: local pnpm format:check, lint, typecheck, map:check, contract:check; CI pnpm verify and pnpm verify:db on PostgreSQL 16.15. Local pnpm verify E2E lacked Chromium; local verify:db lacked DATABASE_URL.
TEST RESULTS: CI PASS, ten database files and 38 tests, including three PEOPLE-03P tests. Clean/upgrade/checksum, NULL/false/true and RLS isolation passed; see CHK-027.
UNRESOLVED ISSUES: U-002 alternate-role behavior UNKNOWN / REQUIRES_OTHER_ROLE; U-003 validation/failure, FLOW-006 write outcomes and Export behavior remain UNKNOWN; SevenRooms evidence classifications unchanged. No People read API/UI/OIDC/session.
NEXT EXACT TASK: PEOPLE-03 — User Accounts read/list backend; READY after verified PEOPLE-03P, not started under PEOPLE-03P CI authorization.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/{roadmap.json,verification.json,handoff.md,app-map.json,feature-registry.json}; docs/data/people-roster-fields.md; all four People migrations; apps/api/tests/people/roster-fields-migrations.test.ts and restricted runtime fixture; tooling/db-test.mjs.
