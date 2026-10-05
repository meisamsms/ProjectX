CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: POLICY-001 — Install reservation-first agent instructions.
STATUS: VERIFIED for instruction/document installation only; core readiness remains unmet.
COMPLETED: Preserved original AGENTS.md and appended owner-approved three-part priority policy, task-selection gate, security boundaries, and evidence-based core readiness gate. Superseded the prior next-action pointer to export with documentation-only PRIORITY-001.
FILES CREATED: None.
FILES MODIFIED: AGENTS.md; docs/project-map/{roadmap.json,verification.json,handoff.md}.
TESTS EXECUTED: pnpm map:check; git diff --check; original instruction prefix, JSON syntax and historical task/check preservation assertions.
TEST RESULTS: PASS for documentation only; CHK-055. No application/runtime/database/E2E verification performed or claimed by this task.
UNRESOLVED ISSUES: Historical module dependency graph still requires People parent completion; PRIORITY-001 must identify minimal reservation prerequisites and remove optional-export coupling with recorded evidence. Core functionality not verified by this task.
PRIORITY PART: Reservation-first policy installation; next task is planning for Part 1 and required Part 2 dependencies.
CORE WORKFLOW ADVANCED: Task selection now prioritizes guest-to-staff reservations; no runtime behavior changed.
CORE READINESS GATE: unmet; no integrated evidence added.
REQUIRED FOUNDATION DEPENDENCIES: Determine concrete minimums in PRIORITY-001; preserve existing security/RLS/venue-access controls.
DEFERRED SECONDARY TASKS AND REASONS: PEOPLE-09, export-only PEOPLE-D010 implementation, and other Part 3 work cannot start under AGENTS.md until core readiness or explicit owner exception. Historical task statuses and accepted design decisions retained; explicit roadmap deferral/classification belongs to PRIORITY-001.
NEXT EXACT TASK: PRIORITY-001 — Reconcile reservation-first roadmap and minimum core dependencies (documentation only); execute AGENTS.md FIRST TASK. Do not begin export or application code in this reconciliation task.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/{roadmap.json,verification.json,app-map.json,decisions.json,people-implementation-plan.md}; relevant existing code/tests/contracts; docs/architecture/ADR-0015-people-accounts-export.md and ADR-0016-people-export-audit-seam.md.

Previous handoff retained below as historical evidence. Its NEXT EXACT TASK and publication constraints do not override the owner's current request to install/publish these instructions or the policy above.

CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: Record PEOPLE-D010 — Export-only durable audit write seam.
STATUS: Owner-approved architecture documented; PEOPLE-09-AUDIT-001 RESOLVED by PEOPLE-D010; PEOPLE-09 BLOCKED -> READY, not implemented/VERIFIED. Local documentation only, no push.
COMPLETED: Verified clean exact base e55fb81424c0089c02075f96891bdbac55482ba4 and expected state. Recorded Option A — narrow export-only writer inside PEOPLE-09, APPROVED / OWNER APPROVED / PROJECTX IMPLEMENTATION DECISION. New ADR-0016; preserved original blocker/CHK-053 and PEOPLE-D009 business contract. No generic Audit module, new roadmap parent or cross-module framework.
FILES CREATED: docs/architecture/ADR-0016-people-export-audit-seam.md.
FILES MODIFIED: docs/project-map/decisions.json, people-implementation-plan.md, roadmap.json, verification.json, handoff.md.
TESTS EXECUTED: pnpm map:check; git diff --check; JSON/unique decision/ADR/reference/approved contract consistency and task dependency DAG; prior VERIFIED task/history/reference/exact documentation-only scope audits.
TEST RESULTS: PASS for architecture documentation only (CHK-054). All 22 previous VERIFIED task objects and 53 historical checks unchanged, PEOPLE-03 prerequisite VERIFIED. No export/audit runtime/PostgreSQL tests or implementation authored/executed/claimed.
APPROVED AUDIT: Export-only append-only metadata: id/organization_id/venue_id/actor_user_id/request_id/event_type/result/exported_row_count/occurred_at; fixed people.accounts.export; success/denied/failed; nullable count only on success and required actual success count. No direct runtime INSERT/UPDATE/DELETE or broad audit SELECT; preferred validated SECURITY DEFINER writer, fixed safe search_path, EXECUTE only runtime/no PUBLIC. No BYPASSRLS/admin request pool/browser authority/arbitrary event/metadata.
DURABILITY: Trusted actor/Organization/Venue/request context and referential ownership validated; User/Organization/Venue exist, Venue belongs to Organization. Existing no-User-ownership-FK attribution pattern requires explicit writer existence checks if retained, no employee/name/lifecycle inference. Denial audit needs no export capability but no roster query/data access; failed export work rolls back then separate bounded failed audit, no internals/resurrection; required success audit/count persists before CSV, audit failure prevents success/partial CSV.
EXCLUSIONS: CSV and exported field values, filename, SQL/stack traces, arbitrary failure payload/metadata JSON, generated-file reference; no export file/job retention. Audit row/request metadata is approved by D010, no new CSV field or D009 business-contract change.
UNRESOLVED ISSUES: Backend/audit still unimplemented; actual schema/writer/helper and PostgreSQL attribution/RLS/immutability/rollback/durability/atomicity tests belong to later PEOPLE-09. Exact-SHA publication approval and final PostgreSQL 16 pnpm verify/verify:db required after implementation. This local architecture documentation SHA also needs separate publication approval. PEOPLE-09B/10 remain PLANNED; no frontend or next task started here.
PRESERVED: PEOPLE-D009 and prior decisions/checks/VERIFIED tasks, PEOPLE-08B VERIFIED, PEOPLE-09 READY, PEOPLE-09B/10 PLANNED, IMPL-MOD-14 IN_PROGRESS. ACT-0056 visible action only; all SevenRooms Export/reference UNKNOWN / NEEDS TESTING, U-001/U-002/U-003 unchanged. No code/tests/migrations/contracts/frontend/main changes or new live evidence/parity.
NEXT EXACT TASK: PEOPLE-09 — People export evidence and scoped backend. Consume PEOPLE-D009 and PEOPLE-D010/ADR-0016; do not implement in this decision task. Publish documentation only with separate exact-SHA approval.
FILES NEXT AGENT MUST READ: AGENTS.md; authoritative roadmap/decisions/verification/handoff/People plan and app-map; ADR-0015/0016; docs/security/authorization-contract.md; apps/api/src/people/authorization/context.ts; existing restricted-role/RLS/grant/roster/history conventions; attached PEOPLE-D010 request and future PEOPLE-09 publication/CI boundary.
