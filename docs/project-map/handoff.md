CURRENT PHASE: PHASE-04 — Core domain implementation, IN_PROGRESS.
CURRENT TASK: RESERVATION-DOMAIN-001 — internal reservation-domain slice.
STATUS: VERIFIED — CHK-081, 2026-10-23. Whole reservation product remains incomplete.
COMPLETED: Search/select/create/occupied/staff get+list/cancel/restored-capacity demo on PostgreSQL16.15; safe table allocation, current tenant/Venue permissions/RLS, idempotency, audit rollback and timezone/DST. Six-table migration/service/tests and entity contract documented. Five one-line ledger-inventory updates preserve exact old checksum/privilege assertions.
FILES CREATED: apps/api/src/reservations/service.ts; apps/api/migrations/zz-reservation-domain/20261017001000_reservation_domain.sql; apps/api/tests/reservations/domain.test.ts; docs/architecture/ADR-0018-reservation-domain-slice.md; docs/data/reservation-domain.md; prior readiness-2026-10-20.md retained.
FILES MODIFIED: tooling/db-test.mjs; apps/api/tests/people/{booked-by,server-names,direct-grants-migrations,rls-migrations,roster-fields-migrations}.test.ts; docs/data/entity-registry.json; roadmap/verification/handoff; README.
TESTS EXECUTED: pnpm db:check; focused domain suite; pnpm verify:db; pnpm verify; isolated Booked By web suite; pnpm map:check; git diff --check; JSON/DAG/history preservation validation.
TEST RESULTS: db smoke2/2; focused26/26; final full database236/236 across22 files; full general gate PASS with4 unit+56 auth+19 API+178 web+32 browser tests, types/lint/format/contracts and API/web builds. Initial8 ledger failures corrected; one web refresh failure did not reproduce in unchanged58/58 isolated or complete rerun. All attempts retained in CHK-081; no current failing gate.
UNRESOLVED ISSUES: Non-reproduced web test cause not proven. Production/public guest access, HTTP/UI reservation integration, modification/check-in/seating, actual confirmations and live-provider verification remain excluded. Remote CI not run. Disposable test container removed after verifying its exact identity/task label; cached image retained.
PRIORITY PART: 1.
CORE WORKFLOW ADVANCED: Persisted internal search → create → occupied → authorized staff read/list → cancel → available.
CORE READINESS GATE: unmet — CHK-081 does not verify all ten guest-to-staff integration criteria.
REQUIRED FOUNDATION DEPENDENCIES: DB-HARNESS-001 and PEOPLE-CORE-01 VERIFIED; CORE-AUTH-02 remains IMPLEMENTED/unverified for live exposure. Original production/settings/widget gates unchanged.
DEFERRED SECONDARY TASKS AND REASONS: PEOPLE-09/09B/10 and export-only PEOPLE-D010 implementation remain deferred under PRIORITY-D001. No stunnel/Cloudflare/Render/Auth0 work; budget $0.
TASK ID: RESERVATION-DOMAIN-001.
DEPENDENCIES AND THEIR VERIFIED STATUS: DB-HARNESS-001 VERIFIED; PEOPLE-CORE-01 VERIFIED; domain acceptance now VERIFIED.
WHY THIS TASK IS REQUIRED NOW: Owner-authorized first functional internal reservation slice.
OWNED SCOPE AND EXCLUDED SCOPE: Internal service/migration/tests/demo/docs; required exact-ledger regression compatibility only. Exclude public/browser routes, auth bypass, new lifecycle features, external confirmation, unrelated runtime edits and push.
ACCEPTANCE CRITERIA: All bounded ADR-0018/roadmap criteria PASS; no whole-product claim.
VERIFICATION COMMANDS: On disposable PG16 _test database with NODE_ENV=test/TEST_DATABASE=1: pnpm db:check; pnpm exec vitest run apps/api/tests/reservations/domain.test.ts --no-file-parallelism --reporter=verbose; pnpm verify:db; pnpm verify; pnpm map:check; git diff --check. Demo-only command adds -t DEMONSTRATION. See docs/data/reservation-domain.md.
REGRESSION CHECKS: Preserve all80 prior checks,26 prior VERIFIED tasks, accepted decisions/reference classifications and historical migrations. RESERVATION-DOMAIN-001-REGRESSION-001 documents five necessary inventory corrections; no original assertions weakened.
DECISION: Current package VERIFIED; next task PROCEED for documentation only, not new code.
NEXT EXACT TASK: RESERVATION-DOMAIN-002 — specify atomic internal reservation modification, documentation only; depends on now-VERIFIED DOMAIN-001 and PEOPLE-CORE-01. Define version/idempotency, permission, capacity-transfer/rollback and timezone tests before separate implementation authorization.
NEXT EXACT CORE TASK OR REQUIRED PREDECESSOR: DOMAIN-002 specification; do not resume infrastructure or expose the internal slice. Existing production tasks keep their gates.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/{roadmap,app-map,dependencies,decisions,verification}.json; ADR-0018; docs/data/reservation-domain.md; docs/data/entity-registry.json; domain service/migration/tests; tooling/db-test.mjs.
PUBLICATION: One logical local feature commit containing CHK-081; parent cba69055c70f750f4c18760e86deeda889d829c1 on people-03-accounts-read. Starting worktree contained known task/readiness changes, preserved. No push; publication requires separate approval. Exact resulting commit SHA is in the completion response/Git log.
