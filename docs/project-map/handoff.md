CURRENT PHASE: PHASE-04 — Core domain implementation, IN_PROGRESS.
CURRENT TASK: RESERVATION-DOMAIN-005 — Staff Reservation Book Browser UI (SCR-002/003/139).
STATUS: VERIFIED under CHK-086.
COMPLETED: Verified starting HEAD 6e84977237db56a5cc7f8831838d1666aaec08e7 on branch people-03-accounts-read. Implemented the Staff Reservation Book browser UI covering SCR-002 (Reservations day), SCR-003 (Add Reservation), and SCR-139 (Reservation Detail) in apps/web/src/reservations/client.ts and apps/web/src/reservations/page.tsx, wired SCR-002 in apps/web/src/shell.tsx, added focused Vitest and Playwright E2E + axe accessibility suites, and verified all application gates.
FILES CREATED: apps/web/src/reservations/client.ts, apps/web/src/reservations/page.tsx, apps/web/tests/reservations/book.test.tsx, tests/e2e/reservations-book.spec.ts, docs/architecture/ADR-0022-staff-reservation-book-ui.md (ACCEPTED).
FILES MODIFIED: apps/web/src/shell.tsx, docs/data/reservation-domain.md, docs/project-map/roadmap.json, docs/project-map/verification.json, docs/project-map/handoff.md.
TESTS EXECUTED: pnpm exec vitest run apps/web/tests/reservations/book.test.tsx apps/web/tests/shell.test.tsx --reporter=verbose (17/17: 15/15 in book.test.tsx + 2/2 in shell.test.tsx); pnpm exec playwright test tests/e2e/reservations-book.spec.ts (9/9 including @axe-core/playwright zero violations); pnpm verify (unit 4/4, auth 56/56, integration 19/19, web 178/178, E2E 41/41, API/web builds); pnpm map:check; git diff --check.
TEST RESULTS: All gates PASS; recorded in CHK-086.
UNRESOLVED ISSUES: CORE-READY-01 remains UNMET. Live staff authentication provider/transport gates (CORE-AUTH-02), Venue reservation settings (SETTINGS-CORE-01), public guest widget endpoints/UI (WIDGET-CORE-01) and confirmation delivery (LANGUAGE-CORE-01) remain separate tasks.
PRIORITY PART: 1.
CORE WORKFLOW ADVANCED: Browser-based staff reservation book (SCR-002/003/139) for availability search, reservation listing/viewing, slot-based creation, modification, check-in, seating and cancellation over authenticated staffFetch.
CORE READINESS GATE: unmet; DOMAIN-001..005 are verified internal, staff-API, and staff-UI slices; public guest widget, confirmation delivery and live-provider gates unchanged.
REQUIRED FOUNDATION DEPENDENCIES: RESERVATION-DOMAIN-001..004, PEOPLE-CORE-01, DB-HARNESS-001 and FOUND-TASK-004 VERIFIED.
DEFERRED SECONDARY TASKS AND REASONS: P3 export/reporting remains deferred under PRIORITY-D001; no infrastructure work; budget $0.
TASK ID: RESERVATION-DOMAIN-005.
DEPENDENCIES AND THEIR VERIFIED STATUS: RESERVATION-DOMAIN-004 (VERIFIED), FOUND-TASK-004 (VERIFIED).
WHY THIS TASK IS REQUIRED NOW: Owner-authorized nonproduction P1 implementation of the Staff Reservation Book browser UI on top of the verified authenticated Staff Reservation HTTP API.
OWNED SCOPE AND EXCLUDED SCOPE: Staff reservation web client and page (SCR-002/003/139), Shell route wiring for SCR-002, focused Vitest and Playwright E2E + axe tests, ADR-0022/docs, and one local commit. No backend or database changes, no public widget routes/UI, no provider configuration or deployment.
ACCEPTANCE CRITERIA: SCR-002/003/139 support date/party/window availability search, slot-based reservation creation, detail viewing, modification, check-in, seating and cancellation; UUID idempotency keys and expectedRevision enforced; unsaved drafts preserved on 400/401/403/404/409/500 with explicit discard confirmation; URL venue slug never trusted as authorization; zero axe accessibility violations; all verification gates pass.
VERIFICATION COMMANDS: pnpm exec vitest run apps/web/tests/reservations/book.test.tsx apps/web/tests/shell.test.tsx --reporter=verbose; pnpm exec playwright test tests/e2e/reservations-book.spec.ts; pnpm verify; pnpm map:check; git diff --check.
REGRESSION CHECKS: All 85 prior checks (CHK-001..CHK-085) and all 30 previously VERIFIED task objects preserved; all existing unit, auth, integration, web and E2E suites pass.
DECISION: VERIFIED; bounded implementation and verification complete. Stop after one local logical commit; do not push or start another task automatically.
NEXT EXACT TASK: Await separate owner authorization for the next dependency-ready Part 1/Part 2 core task (e.g., WIDGET-CORE-01 public guest booking contract, SETTINGS-CORE-01 Venue reservation settings contract, or LANGUAGE-CORE-01 confirmation contract). Do not start automatically.
NEXT EXACT CORE TASK OR REQUIRED PREDECESSOR: Public guest reservation widget contract (WIDGET-CORE-01) or Venue reservation settings contract (SETTINGS-CORE-01) after explicit owner authorization.
FILES NEXT AGENT MUST READ: AGENTS.md; ADR-0018/0019/0020/0021/0022; docs/data/reservation-domain.md; apps/web/src/reservations/page.tsx; apps/api/src/reservations/route.ts; docs/project-map/roadmap.json; docs/project-map/verification.json; docs/project-map/handoff.md.
CAPABILITIES: restaurant agent plus independent QA subagent verification; bounded-implementation, restaurant-workflows, playwright-best-practices and a11y-debugging skills applied.
PUBLICATION: One local logical commit created on branch people-03-accounts-read above 6e84977237db56a5cc7f8831838d1666aaec08e7; NOT pushed. Remote publication requires separate explicit owner approval.
