CURRENT PHASE: PHASE-04 — Core domain implementation, IN_PROGRESS.
CURRENT TASK: RESERVATION-DOMAIN-006 — Public Guest Booking Boundary Contract (ADR-0023).
STATUS: VERIFIED under CHK-087.
COMPLETED: Verified starting HEAD e182477 on branch people-03-accounts-read. Authored ADR-0023-public-guest-booking-boundary.md defining the public Venue slug lookup, purpose-limited availability projection, narrow SECURITY DEFINER guest reservation creation without fabricated staff identities, Venue-scoped guest idempotency, rate-limit/abuse protections, honest non-delivery confirmation response (confirmationDelivery: NONE), and registered the two bounded implementation packages RESERVATION-DOMAIN-007 (Package A: Public backend) and RESERVATION-DOMAIN-008 (Package B: Public widget SCR-072).
FILES CREATED: docs/architecture/ADR-0023-public-guest-booking-boundary.md (ACCEPTED).
FILES MODIFIED: docs/data/reservation-domain.md, docs/project-map/roadmap.json, docs/project-map/verification.json, docs/project-map/handoff.md.
TESTS EXECUTED: pnpm map:check; git diff --check (documentation-only contract package).
TEST RESULTS: All documentation and project-map validation checks PASS; recorded in CHK-087.
UNRESOLVED ISSUES: CORE-READY-01 remains UNMET. Public guest booking backend (RESERVATION-DOMAIN-007) and public reservation widget UI (RESERVATION-DOMAIN-008) await explicit owner implementation authorization.
PRIORITY PART: 1.
CORE WORKFLOW ADVANCED: Public guest booking security, PostgreSQL RLS/FK/audit boundary, and API/UI contract decomposition (ADR-0023).
CORE READINESS GATE: unmet; DOMAIN-001..005 are verified runtime slices and DOMAIN-006 is the verified public boundary contract; public runtime slices (DOMAIN-007/008) and live-provider gates remain.
REQUIRED FOUNDATION DEPENDENCIES: RESERVATION-DOMAIN-001..005, PEOPLE-CORE-01, DB-HARNESS-001 and FOUND-TASK-004 VERIFIED.
DEFERRED SECONDARY TASKS AND REASONS: P3 export/reporting remains deferred under PRIORITY-D001; full SETTINGS-CORE-01 and LANGUAGE-CORE-01 editors remain separate; budget $0.
TASK ID: RESERVATION-DOMAIN-006.
DEPENDENCIES AND THEIR VERIFIED STATUS: RESERVATION-DOMAIN-004 (VERIFIED), RESERVATION-DOMAIN-005 (VERIFIED).
WHY THIS TASK IS REQUIRED NOW: Owner-authorized minimum prerequisite specification resolving the public guest booking security and database boundary before implementing public booking endpoints and the SCR-072 widget.
OWNED SCOPE AND EXCLUDED SCOPE: ADR-0023, reservation-domain.md update, roadmap registration of RESERVATION-DOMAIN-006/007/008, verification check CHK-087, and handoff update. No production code, migrations, or widget UI changes in this package.
ACCEPTANCE CRITERIA: All 9 public booking boundary topics specified consistently with existing RLS, FK, audit, permission and idempotency rules; two bounded implementation packages (RESERVATION-DOMAIN-007 and RESERVATION-DOMAIN-008) registered with exact dependencies and gates; pnpm map:check and git diff --check pass.
VERIFICATION COMMANDS: pnpm map:check; git diff --check.
REGRESSION CHECKS: All 86 prior checks (CHK-001..CHK-086) and all 31 previously VERIFIED task objects preserved unchanged.
DECISION: VERIFIED; bounded specification complete. Stop and await owner authorization for RESERVATION-DOMAIN-007.
NEXT EXACT TASK: RESERVATION-DOMAIN-007 — Public Guest Booking Backend & PostgreSQL Security Slice (Package A under ADR-0023), upon explicit owner authorization.
NEXT EXACT CORE TASK OR REQUIRED PREDECESSOR: RESERVATION-DOMAIN-007 (followed by RESERVATION-DOMAIN-008 for SCR-072 widget UI).
FILES NEXT AGENT MUST READ: AGENTS.md; ADR-0018/0019/0020/0021/0022/0023; docs/data/reservation-domain.md; apps/api/migrations/zz-reservation-domain/20261017001000_reservation_domain.sql; apps/api/migrations/zz-reservation-domain/20261026001200_reservation_lifecycle.sql; apps/api/src/reservations/service.ts; docs/project-map/roadmap.json; docs/project-map/verification.json; docs/project-map/handoff.md.
CAPABILITIES: architecture/restaurant contract specification; api-contracts, database-isolation and restaurant-workflows skills applied.
PUBLICATION: One local logical commit created on branch people-03-accounts-read above e182477; NOT pushed. Remote publication requires separate explicit owner approval.
