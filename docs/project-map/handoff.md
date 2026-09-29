CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: PEOPLE-03 — User Accounts read/list backend, readiness transition only.
STATUS: READY — no PEOPLE-03 implementation started. PEOPLE-01, PEOPLE-01B and PEOPLE-02 remain VERIFIED; PEOPLE-04 remains PLANNED; IMPL-MOD-14 remains IN_PROGRESS.
COMPLETED: Roadmap state transition only. PEOPLE-02 verified; PEOPLE-03 dependency satisfied and nextExactTask already identifies PEOPLE-03.
FILES CREATED: None.
FILES MODIFIED: docs/project-map/roadmap.json; docs/project-map/verification.json; docs/project-map/handoff.md.
TESTS EXECUTED: pnpm map (command unavailable); pnpm map:check and explicit roadmap dependency/status invariants.
TEST RESULTS: Roadmap dependency and cycle validation PASS; no implementation code changed. PEOPLE-02 PostgreSQL 16 CI verification remains recorded in CHK-023.
UNRESOLVED ISSUES: U-002 alternate-role reference behavior UNKNOWN / REQUIRES_OTHER_ROLE; FLOW-006 outcomes unknown. SevenRooms evidence classifications unchanged.
NEXT EXACT TASK: PEOPLE-03 — User Accounts read/list backend.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/{roadmap.json,verification.json,handoff.md,people-implementation-plan.md}; docs/security/{permission-registry.json,authorization-contract.md,people-authorization-rls.md}; docs/data/{people-core-persistence.md,people-grants-persistence.md,rls-policy-model.md}; all three People migrations and database tests.
