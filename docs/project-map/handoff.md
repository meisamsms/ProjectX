CURRENT PHASE: PHASE-03 Architecture decisions and secure foundations — IN_PROGRESS.
CURRENT TASK: FOUND-TASK-002 — Identity, access and venue context
STATUS: VERIFIED — documentation contract validated; FOUND-TASK-003 READY.
COMPLETED: Defined User/OIDC identity, Organization, membership, Venue Access, scope grants, server session/context, object and Client visibility, failures, audit, minimum permission vocabulary and future test matrix.
FILES CREATED: docs/security/identity-access-model.md; docs/security/authorization-contract.md; docs/security/permission-registry.json; docs/security/access-test-matrix.md.
FILES MODIFIED: docs/project-map/roadmap.json; docs/project-map/verification.json; docs/project-map/handoff.md.
TESTS EXECUTED: JSON parse; permission ID uniqueness and enums; module references; ADR and roadmap prerequisite checks; terminology and documentation-only scope review.
TEST RESULTS: PASS — 22 unique permission IDs; no application code, migration, scaffold, package installation, API, UI or OIDC integration. Runtime behavior not tested.
UNRESOLVED ISSUES: Reference alternate-role behavior, exact Client field policy, IdP provider, session/MFA timeouts and provider events need policy or isolated testing; reference internals remain UNKNOWN. Reporting detail deferred.
NEXT EXACT TASK: FOUND-TASK-003 — Data contracts and persistence foundations: define tenant keys, membership/Venue Access persistence boundaries, transaction-local RLS context and isolation tests from this contract. Do not execute in FOUND-TASK-002.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/roadmap.json; docs/project-map/app-map.json; docs/project-map/dependencies.json; docs/project-map/decisions.json; docs/project-map/verification.json; docs/project-map/handoff.md; docs/architecture/ADR-0001-deployment-topology.md through ADR-0006-recovery-and-environments.md; docs/security/identity-access-model.md; docs/security/authorization-contract.md; docs/security/permission-registry.json; docs/security/access-test-matrix.md.
