CURRENT PHASE: PHASE-04 — IN_PROGRESS.
CURRENT TASK: RESERVATION-DOMAIN-007 evidence reconciliation.
STATUS: VERIFIED within bounded backend scope under CHK-091.
COMPLETED: Reconciled contradictory earlier port/exit/sign-off claims with fresh controlled gate evidence; implementation commit 57f65e12b64d6e78853e99c47185899df3bc5c31 preserved.
FILES CREATED: None in repository.
FILES MODIFIED: docs/project-map/verification.json, roadmap.json, handoff.md.
TESTS EXECUTED: pnpm verify:db; pnpm verify.
TEST RESULTS: Both exit 0; 292 database tests across 25 files, PostgreSQL 16.15; 299 application/browser tests and both builds PASS. Complete logs and UTC metadata: C:/Users/barak/.codex/visualizations/2026/10/20/01a15b3d-c097-7562-a5f6-4b91c3ba7132/domain007-evidence.
UNRESOLVED ISSUES: Earlier 55432 versus 55437 claims lack independently recoverable provenance; new run verified 55437. Earlier purported subagent requirement unsupported by AGENTS.md. Production/live authentication, widget and integrated core readiness remain unverified.
TASK ID: RESERVATION-DOMAIN-007.
PRIORITY PART: 1.
CORE WORKFLOW ADVANCED: Guest availability and atomic booking with staff visibility within backend boundary.
DEPENDENCIES AND THEIR VERIFIED STATUS: DOMAIN-006, DOMAIN-004 and DB-HARNESS-001 verified.
WHY THIS TASK IS REQUIRED NOW: Owner authorized resolving missing verification evidence.
OWNED SCOPE AND EXCLUDED SCOPE: Verification and three project-map documents only; no implementation, deployment, publication or DOMAIN-008.
ACCEPTANCE CRITERIA: Both complete gates pass with captured logs, database identity and exit codes; preserve historical checks.
VERIFICATION COMMANDS: pnpm verify:db; pnpm verify; pnpm map:check; git diff --check.
REGRESSION CHECKS: Prior 88 check objects and 67 unrelated task records preserved.
DECISION: VERIFIED within demonstrated backend scope.
CORE READINESS GATE: unmet; see CHK-091.
REQUIRED FOUNDATION DEPENDENCIES: Trusted staff authentication and isolation remain mandatory for live use.
DEFERRED SECONDARY TASKS AND REASONS: P3 deferred until core readiness gate.
NEXT EXACT TASK: Owner review and separate publication authorization for local commits.
NEXT EXACT CORE TASK OR REQUIRED PREDECESSOR: DOMAIN-008 requires separate owner authorization.
FILES NEXT AGENT MUST READ: AGENTS.md, this handoff, CHK-091, roadmap.json, ADR-0023.
