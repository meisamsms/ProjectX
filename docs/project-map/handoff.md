CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS; PHASE-03 VERIFIED.
CURRENT TASK: IMPL-MOD-14 planning decomposition only
STATUS: DOCUMENTED — parent IN_PROGRESS, PEOPLE-01 READY; no People implementation.
COMPLETED: Confirmed four screens, nine actions, FLOW-006, four mapped entities and unknowns; defined 14 bounded child tasks, dependency DAG, fixtures and export evidence gate.
FILES CREATED: docs/project-map/people-implementation-plan.md.
FILES MODIFIED: docs/project-map/roadmap.json; docs/project-map/verification.json; docs/project-map/handoff.md.
TESTS EXECUTED: JSON parse; unique child IDs; DAG; screen/action/entity/module/workflow refs; one READY child; previous VERIFIED gates; document-only file audit; pnpm map:check.
TEST RESULTS: Planning validation PASS; no migration, OIDC, People API/UI or domain code. Runtime tests NOT_APPLICABLE.
UNRESOLVED ISSUES: FLOW-006 outcomes/cancel and alternate-role permissions UNKNOWN; PEOPLE-09 Export backend is BLOCKED; PEOPLE-09B frontend follows on format/field/security evidence or explicit ProjectX owner specification. Parent not VERIFIED.
NEXT EXACT TASK: PEOPLE-01 — People core persistence and domain contracts: implement only User/identity/Organization/Venue/Membership/VenueAccess migration and isolated fixtures; prove composite keys, uniqueness and revoke/disable lifecycle. Do not execute PEOPLE-01B or other children.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/roadmap.json; docs/project-map/people-implementation-plan.md; docs/project-map/app-map.json; docs/project-map/feature-registry.json; docs/project-map/dependencies.json; docs/project-map/decisions.json; docs/project-map/verification.json; docs/project-map/handoff.md; docs/architecture/ADR-0001–0007; docs/security/identity-access-model.md; docs/security/authorization-contract.md; docs/security/permission-registry.json; docs/data/persistence-model.md; docs/data/tenant-isolation.md; docs/data/rls-policy-model.md; docs/data/migration-strategy.md; docs/data/database-test-plan.md; docs/data/transaction-boundaries.md.
