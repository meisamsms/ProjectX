CURRENT PHASE: PHASE-04 — IN_PROGRESS.
CURRENT TASK: RESERVATION-DOMAIN-008.
STATUS: VERIFIED bounded nonproduction widget; CHK-092 finalSynchronizationVerification.
COMPLETED: Reused widget search/create/retry/confirmation and public route separation; opt-in localhost proxy disabled in production; real guest-to-staff integration verified. Authorized one-line focus-test waitFor correction preserves exact assertion and People behavior.
FILES CREATED: widget-client.ts, widget-page.tsx, widget.test.tsx, reservations-widget.spec.ts, reservations-widget-real.spec.ts.
FILES MODIFIED: apps/web/src/main.tsx; apps/web/vite.config.ts; apps/web/tests/people/add-user.test.tsx; ADR-0023; roadmap.json; verification.json; handoff.md.
TESTS EXECUTED: Focused People/widget Vitest48/48; final pnpm verify exit0 (4 unit,56 auth,19 integration,178 web,43 browser;1 opt-in test skipped); both builds PASS; proxy guards PASS; map/contract/whitespace checks PASS.
REUSED EVIDENCE: PostgreSQL16.15 database292/292, public/boundary12/12, expanded real guest-to-staff browser1/1 and widget/shell10/10; unchanged by focus-test correction.
TEST RESULTS: PASS within bounded scope. Earlier full-gate failures retained in CHK-092. QA reproduced focus assertion without widget; browser timeout cause remains unconfirmed despite10/10 diagnostic passes. No retries used to hide failures.
UNRESOLVED ISSUES: No local implementation gate blocker. Separate publication approval/CI; live staff provider, external delivery and production/core readiness remain unverified.
TASK ID: RESERVATION-DOMAIN-008.
PRIORITY PART: 1.
CORE WORKFLOW ADVANCED: Guest booking to authorized staff visibility.
DEPENDENCIES AND THEIR VERIFIED STATUS: DOMAIN-007, DOMAIN-005, FOUND-TASK-004 remain VERIFIED.
WHY REQUIRED NOW: Owner authorized final regression recovery and one local commit.
OWNED SCOPE: Existing widget, bounded localhost integration, evidence and explicit focus-test synchronization only. No People production changes, deployment or DOMAIN-009.
ACCEPTANCE: Focused and final gates PASS; original focus assertion preserved; staff/public security boundaries unchanged.
REGRESSION CHECKS: Historical checks and other task objects preserved; backup retained.
DECISION: Local completion; no push.
CORE READINESS GATE: unmet; nonproduction scope only.
DEFERRED SECONDARY TASKS: P3 deferred until core readiness.
NEXT EXACT TASK: Owner review of local commit; no automatic further implementation.
FILES NEXT AGENT MUST READ: AGENTS.md; CHK-091/092; ADR-0023; widget and integration tests.
GIT BASE: 110238af28e8fa9a608dae8d8a2464d1cafc9d29. One new local child commit after verification; resolve SHA from Git.
SKILLS / AGENTS: No specialized skill workflow; primary Codex plus existing read-only /root/qa_debug investigation. No new delegation this final correction turn.
CLEANUP: Disposable database containers removed in prior recovery; no new infrastructure started for final test-only correction.
