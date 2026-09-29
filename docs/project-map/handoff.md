CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: PEOPLE-03 — User Accounts read/list backend, prerequisite audit.
STATUS: BLOCKED — required SCR-025 persisted Name, Job Title and Email Notifications fields are absent from verified People persistence. Proposed PEOPLE-03P is blocked on a ProjectX field-ownership/absence contract; no PEOPLE-03 endpoint implemented.
COMPLETED: Verified PEOPLE-01, PEOPLE-01B, PEOPLE-02 and initial PEOPLE-03 readiness; SCR-025 remains NOT_IMPLEMENTED. Read People migrations, authorization/RLS, discovery and API contracts. Recorded narrow PEOPLE-03P predecessor and stopped at the prompt's schema-gap gate.
FILES CREATED: None.
FILES MODIFIED: docs/project-map/roadmap.json; docs/project-map/verification.json; docs/project-map/handoff.md.
TESTS EXECUTED: pnpm map:check and roadmap status/dependency audit after documentation update. No API or PostgreSQL PEOPLE-03 tests: implementation did not start.
TEST RESULTS: See CHK-025. No new API, migration, generated type or CI run. Previously verified PEOPLE-02 CI remains CHK-023.
UNRESOLVED ISSUES: ProjectX roster field ownership/nullability and notification status scope. U-002 alternate-role behavior UNKNOWN / REQUIRES_OTHER_ROLE; U-003 validation/failure, FLOW-006 write outcomes and Export behavior remain UNKNOWN. SevenRooms evidence classifications unchanged.
NEXT EXACT TASK: PEOPLE-03P — decide and verify narrow SCR-025 roster-field persistence prerequisite before resuming PEOPLE-03.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/{roadmap.json,verification.json,handoff.md,people-implementation-plan.md,app-map.json,feature-registry.json}; docs/security/{permission-registry.json,authorization-contract.md,people-authorization-rls.md}; docs/data/{people-core-persistence.md,people-grants-persistence.md,rls-policy-model.md}; all People migrations and fixtures.
