CURRENT PHASE: PHASE-04 — Core domain implementation, IN_PROGRESS.
CURRENT TASK: RESERVATION-DOMAIN-002 — atomic internal reservation modification.
STATUS: VERIFIED — CHK-082, 2026-10-25. Internal package only; whole browser reservation product incomplete.
COMPLETED: modifyReservation changes BOOKED date/start/table/shift/party atomically; preserves IDs/contact/tenant; expected revision, separate durable modification keys, exact historical-result replay, immutable narrow before/after audit and exclusion protection. Both cancellation lock orders, access revocation while waiting, raw SQL denials, DST and rollback verified. Synthetic create/modify/read/failed-change/cancel demonstration PASS.
FILES CREATED: apps/api/migrations/zz-reservation-domain/20261024001100_reservation_modification.sql; docs/architecture/ADR-0019-atomic-reservation-modification.md.
FILES MODIFIED: reservation service and domain tests; five People ledger test inventories; docs/data/{reservation-domain.md,entity-registry.json}; roadmap/verification/handoff. Total14 files.
TESTS EXECUTED: pnpm db:check; focused reservation suite; pnpm lint; pnpm typecheck; pnpm verify:db; pnpm verify; pnpm map:check; git diff --check; historical object/ledger checks.
TEST RESULTS: Smoke2/2; focused50/50 (26 DOMAIN-001+24 DOMAIN-002); full database260/260 in22 files on PostgreSQL16.15; general gate4 unit+56 auth+19 API+178 web+32 browser PASS; API/web builds PASS. Final documentation validation before commit.
UNRESOLVED ISSUES: None in bounded package. Initial sandbox localhost EACCES resolved through approved test execution; automatic security-boundary review rejection resolved by explicit owner approval. Both retained in CHK-082. Public/browser integration, lifecycle check-in/seating, confirmations and live-provider/HTTPS gates remain unverified. Disposable container removed by exact ID after tests; no customer data/services used.
PRIORITY PART: 1.
CORE WORKFLOW ADVANCED: Create → modify allocation → original slot released/new occupied → authorized staff read → failed change preserves state → cancel → restored capacity.
CORE READINESS GATE: unmet — CHK-081/082 verify internal slices, not all ten integrated criteria.
REQUIRED FOUNDATION DEPENDENCIES: DOMAIN-001, PEOPLE-CORE-01 and DB-HARNESS-001 VERIFIED. Existing production-auth/settings/widget gates unchanged.
DEFERRED SECONDARY TASKS AND REASONS: PEOPLE-09/09B/10 and export-only PEOPLE-D010 remain deferred under PRIORITY-D001. No infrastructure research/provisioning; budget$0.
TASK ID: RESERVATION-DOMAIN-002.
DEPENDENCIES AND THEIR VERIFIED STATUS: Mandatory DOMAIN-001 and PEOPLE-CORE-01 VERIFIED. Owner explicitly approved bounded implementation and exact ADR-0019 database boundary.
WHY THIS TASK IS REQUIRED NOW: Owner expanded the existing documentation-only task to one complete implementation package; historical authorization retained in roadmap.
OWNED SCOPE AND EXCLUDED SCOPE: Internal service/additive migration/tests/demo/docs/local commit only. No public routes, UI, widget, production synthetic authentication, provider changes, check-in/seating, delivery or push.
ACCEPTANCE CRITERIA: All bounded ADR-0019/roadmap criteria PASS: version/idempotency, atomic transfer/rollback, concurrency/cancel, permission/RLS, timezone/DST and regression preservation.
VERIFICATION COMMANDS: On disposable PostgreSQL16 _test database with NODE_ENV=test/TEST_DATABASE=1: pnpm db:check; pnpm exec vitest run apps/api/tests/reservations/domain.test.ts --no-file-parallelism --reporter=verbose; pnpm verify:db; pnpm verify; pnpm map:check; git diff --check. Add -t DEMONSTRATION for both synthetic demos.
REGRESSION CHECKS: All81 prior checks,27 prior VERIFIED tasks and all other prior task objects unchanged. Historical SQL/auth/decisions/reference evidence unchanged. DOMAIN-002-REGRESSION-001: five one-line ledger appends and additive schema replay; checksum/privilege/shape assertions preserved; persisted old data upgrade tested.
DECISION: DOMAIN-002 VERIFIED. Next task proposed only, no automatic implementation.
NEXT EXACT TASK: RESERVATION-DOMAIN-003 — bounded internal check-in/seating transitions; separate owner authorization and explicit transition contract required.
NEXT EXACT CORE TASK OR REQUIRED PREDECESSOR: DOMAIN-003 dependencies DOMAIN-002 and PEOPLE-CORE-01 now VERIFIED. Do not bypass original production integration gates or resume unrelated infrastructure.
FILES NEXT AGENT MUST READ: AGENTS.md; roadmap/app-map/decisions/verification; ADR-0018/0019; docs/data/reservation-domain.md; entity registry; reservation service/migrations/tests and existing authorization helper.
PUBLICATION: One logical local commit with parent3f714406acfc74af9e982f321724848424996f40 on people-03-accounts-read; exact result SHA in final response/Git history. No push; separate publication approval required. No current-commit remote CI claim. DOMAIN-001 publication CI is separately recorded in CHK-082 baselinePublication.
