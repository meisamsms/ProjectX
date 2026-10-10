CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: CORE-AUTH-02-ENV-LOCAL-001 — Read-only safety review.
STATUS: Review DOCUMENTED in CHK-074; actual environment task BLOCKED. Environment readiness NO; provider NEEDS TESTING.
COMPLETED: Pinned cloudflared2026.10.0 (2026-10-05) source/official documentation review; header matrix, logging/HTTPS/cookie/cache/lifecycle/protected-tunnel/Auth0 assessment and fake-only experiment design in ADR-0017. No installation/exposure/accounts/resources/secrets/runtime changes.
FILES CREATED: None.
FILES MODIFIED: docs/architecture/ADR-0017-zero-cost-provider-verification.md; docs/project-map/{roadmap,verification}.json; docs/project-map/handoff.md; docs/security/staff-session-verification.md.
TESTS EXECUTED: pnpm map:check; git diff --check; JSON/IDs/DAG/history/status/scope checks. No runtime/tunnel/provider tests.
TEST RESULTS: PASS map144screens/16modules/57tasks; diff/JSON/IDs/taskDAG; all73priorCHK,26VERIFIED and54unrelated tasks, all decision/reference data and prior ADR/security sections preserved. Initial diff-check trailing blank line corrected. Five documentation files only; no runtime/provider tests.
UNRESOLVED ISSUES: Gate001 BLOCKED: default QUIC error destination can expose query, independent management logger, unknown accountless platform retention/redaction/access. Gate002 READY FOR INERT-CANARY TEST: actual HTTP/authority/forwarding/cookies/cache unproved. Gate003 BLOCKED: actual Auth0 Free eligibility/settings/no-trial dependence unverified. Real callbacks prohibited.
PRIORITY PART: 2 — REQUIRED FOUNDATION.
CORE WORKFLOW ADVANCED: Bounded safety prerequisite for trusted staff verification before SETTINGS-CORE-01 and reservation book/check-in/seating; no domain implementation.
CORE READINESS GATE: UNMET — CORE-READY-01.
REQUIRED FOUNDATION DEPENDENCIES: CORE-AUTH-01/PEOPLE-CORE-01 VERIFIED; CORE-AUTH-02 IMPLEMENTED; DEPLOY-002 prior local/published evidence retained; D004–D007 APPROVED. Paid ENV-001 remains PLANNED with DEFERRED metadata.
DEFERRED SECONDARY TASKS AND REASONS: PEOPLE-09 READY / PART3 DEFERRED; PEOPLE-09B/10 PLANNED / DEFERRED until core readiness or specific owner exception. SETTINGS-CORE-01 PLANNED awaiting VERIFIED auth; IMPL-MOD-14 IN_PROGRESS.
TASK-SELECTION GATE: LOCAL-001 / Part2 / PROCEED for research/documentation only; five-document scope. Acceptance: pinned primary evidence, explicit uncertainty, safety dispositions, fake-only plan, historical preservation. Excludes runtime/tests/migrations/gateway/config/DB/accounts/install/tunnel/exposure/spend/push. No code authorized.
ASSURANCE: Existing explicit ordinary-positive / privileged-fail-closed acceptance alternative retained, not silently invented. Controlled proof absent; positive high-risk MFA unverified/unavailable in candidate. D004 unchanged; no owner decision needed merely to retain this boundary.
SEVENROOMS TRACK: U-001/U-002/U-003 and all reference classifications unchanged; no new evidence/parity claims.
NEXT EXACT TASK: CORE-AUTH-02-ENV-LOCAL-002 — Disposable inert-canary Quick Tunnel transport verification.
NEXT EXACT CORE TASK OR REQUIRED PREDECESSOR: LOCAL-002 is PLANNED, requires separate execution authorization. Disposable fake-only loopback echo/mock; NO ProjectX/Auth0/PostgreSQL/real callback/secrets/reference data; no debug/trace/streaming/support bundle or protected-email flow. Source-confirmed unsafe default requires diagnosis, not automatic suppression approval. Canary cannot certify inaccessible provider logs or make LOCAL-001 READY on its own.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/{roadmap,app-map,decisions,dependencies,verification}.json; ADR-0017 CHK-074 addendum; docs/security/{staff-session-verification,staff-access-integration,staff-session-database-review,identity-access-model,authorization-contract}.md; deploy/gateway/{nginx.conf.template,start.sh,gateway.test.mjs}; apps/api/src/staff-auth/{config,oidc,routes}.ts.
PUBLICATION: One documentation-only local child of 4c31545a87e6ac3b2ec440953c310e034fbf1a38; no push. Separate exact-SHA approval required.
