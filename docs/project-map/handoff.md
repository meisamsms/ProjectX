CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: PEOPLE-04 — Add User command/backend.
STATUS: BLOCKED before implementation — ProjectX email ownership and pre-provisioning identity linkage are not approved or persisted. PEOPLE-05 VERIFIED; PEOPLE-09 BLOCKED; parent IMPL-MOD-14 IN_PROGRESS.
COMPLETED: Read-only prerequisite audit confirmed the reference-visible Email field cannot safely map to the verified schema. AuthenticatedIdentity contains only opaque verified OIDC issuer/subject and must not use unverified email as an identity key. PEOPLE-04 transitioned READY to BLOCKED; no backend implementation started.
FILES CREATED: None.
FILES MODIFIED: docs/project-map/roadmap.json; docs/project-map/verification.json; docs/project-map/handoff.md.
TESTS EXECUTED: pnpm map:check; git diff --check.
TEST RESULTS: PASS — pnpm map:check validated 144 screens, 16 modules and 41 roadmap tasks; git diff --check passed. No API or PostgreSQL test was applicable because implementation stopped at the missing prerequisite.
UNRESOLVED ISSUES: Product-owner decision required for Add User email ownership, normalization/uniqueness/lifecycle and later verified-identity linkage. PEOPLE-09 remains BLOCKED. U-001/U-002/U-003, FLOW-006 success/failure, role precedence and reference validation behavior remain UNKNOWN / NEEDS TESTING.
NEXT EXACT TASK: Product-owner decision — Define ProjectX Add User email ownership and pre-provisioning identity linkage prerequisite.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/{roadmap.json,verification.json,handoff.md,app-map.json,feature-registry.json,people-implementation-plan.md}; docs/data/{people-core-persistence.md,people-roster-fields.md,people-accounts-read.md,persistence-model.md}; docs/security/{identity-access-model.md,people-authorization-rls.md}; apps/api/migrations/people-core/20260928000100_people_core.sql.
