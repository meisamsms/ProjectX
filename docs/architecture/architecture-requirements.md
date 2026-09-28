# Architecture requirements — ARCH-001

Status: **owner architecture choices approved in ADR-0001–ADR-0006**. Source: verified ProjectX discovery, app-map.json, dependencies.json. CONFIRMED denotes visible product behavior; INFERRED denotes a proposed implementation requirement; UNKNOWN/NEEDS TESTING remain open. No statement below describes SevenRooms internals.

## Product-driven constraints

- CONFIRMED: Venue selection, user access levels with granular permissions and optional multi-venue account assignment (SCR-025/026); reservations link guests, dates, shifts, tables, seating areas and access rules (SCR-002/003/139).
- CONFIRMED: Shift previews combine floorplan, area reservability, duration, pacing, payment/policy and booking windows (SCR-142); availability is date/audience/rule/area sensitive (SCR-070).
- CONFIRMED: 144 screens, 16 modules and 18 workflows; detailed Reporting parity deferred by product owner. No reference stack, topology, internal schema or API was observed.
- INFERRED: Modules should own bounded behavior and expose reviewed contracts so an agent can finish a schema, data access, domain rule, API, client, screen or verification task without changing unrelated modules.

## Decision gates

Six combined owner questions in decisions.json cover ARCH-D001–D011 and D015/D016/D018. All six owner choices and dependent decision topics are APPROVED in ADR-0001–ADR-0006; FOUND-TASK-002 may now proceed. Cloud vendor and operating budget remain later selections. The remaining ARCH-D012–D014, D017, D019/D020 are proposed technical defaults or deferred work.

## Requirement register

| Area | Requirement or bounded unknown | Evidence/status |
|---|---|---|
| Application topology | Keep venue-scoped reservation, availability and guest transactions consistent; choose deployable boundaries in ARCH-D001. | INFERRED from SCR-003/070/142; topology UNKNOWN |
| Frontend architecture | Support forms, calendar/grid/floorplan, nested panels, keyboard and responsive access; select framework/runtime in ARCH-D002. | CONFIRMED UI; framework UNKNOWN |
| Backend architecture | Enforce authorization and invariants server-side across modules; choose language/framework in ARCH-D003. | INFERRED; reference backend UNKNOWN |
| Repository structure | Stable module contracts and small reviewable tasks; monorepo/multiple repos in ARCH-D005. | INFERRED |
| Runtime/language | Supported, maintained runtime and reproducible builds; Node.js LTS + Fastify + TypeScript approved. | UNKNOWN owner choice |
| Primary database | Relational links and transactional booking constraints favor a transactional store, but selection is ARCH-D004. | INFERRED, not schema evidence |
| Account, organization, venue | Venue URLs/selector and multi-venue user access are visible; ProjectX Organization/Venue/Client hierarchy approved in ADR-0003; reference internals remain unknown. | CONFIRMED surfaces; hierarchy UNKNOWN |
| Tenant isolation | Explicit scope on every read/write/job/export and object authorization; enforcement model ARCH-D007. | INFERRED security requirement |
| Authentication/session | MFA option visible; secure sign-in/session lifetime and credential ownership require ARCH-D008. | CONFIRMED option; behavior UNKNOWN |
| Authorization | Venue-scoped role and granular permission checks for UI and API; alternative roles untested; ARCH-D009. | CONFIRMED controls; grants UNKNOWN |
| API style | Stable versioned contracts, deliberate pagination/filter/sort and transition commands; style ARCH-D010. | INFERRED |
| Validation/shared contracts | Server-side bounded input schemas, one reviewed contract authority and generated/checked client types; ARCH-D011. | INFERRED |
| Error contract | Machine code, safe message, correlation ID, field issues and retry semantics; no guest PII in error detail. | INFERRED default |
| Persistence pattern | Data access must always carry actor/tenant/venue context; no persistence implementation chosen. | INFERRED |
| Transactions | Reservation assignment, availability checks and payment-adjacent state need atomicity or explicit compensation; exact guards NEEDS TESTING. | INFERRED from workflows |
| Concurrency | Prevent double assignment and stale shift/table edits; choose version check/lock at implementation with isolated tests. | INFERRED, exact conflict behavior UNKNOWN |
| Idempotency | Guard booking, payment, import and webhook retries against duplicate effects. | INFERRED |
| Audit logging | Immutable actor/venue/object/action metadata for status, permission, import and configuration changes; redact secrets and PII. | CONFIRMED activity display; persistence UNKNOWN |
| Background jobs/events | Delivery, import, exports may need asynchronous execution; select queue/event mechanism only for proven use. | INFERRED; delivery UNKNOWN |
| Cache | Correctness and invalidation before caching availability; defer infrastructure until measured. | INFERRED/deferred |
| File/object storage | Imports and optional exports may require isolated, scanned, expiring storage; no vendor chosen. | INFERRED |
| Secrets/configuration | Isolate runtime secrets from repository, logs and client; validate typed configuration per environment. | INFERRED security requirement |
| Observability | Structured redacted logs, metrics, traces/correlation and actionable alerts for booking/security failures. | INFERRED |

## Additional constraints

- Testing: mandatory focused unit, database, integration, API contract, tenant isolation/authorization, E2E, accessibility, security, migration and regression gates by change type (see security-baseline.md).
- Migration: versioned, reversible where possible, dry-run and rollback/forward plan with production backup; no migrations in ARCH-001.
- Backup/recovery/disaster recovery: owner-approved RPO 1 hour/RTO 4 hours and separate development/staging/production in ADR-0006; verify restores and operational ownership before launch.
- CI/CD and environment separation: isolate development, staging and production data/credentials; peer review, gated deploy, rollback and audit release provenance. Number of environments/cost is owner decision.
- Security: deny by default, object-level venue authorization, abuse limits, import quarantine, verified webhooks, safe exports and PII minimization. No vulnerability is asserted in the reference.
- Dates/time zones: store absolute instants with venue time zone and local service date; DST boundaries need tests. Do not infer SevenRooms storage representation.
- Money: if charging is enabled, represent amounts in integer minor units with currency and explicit rounding policy; payment execution remains out of discovery scope.
- Localization/accessibility: language templates and date formats are visible; externalize copy, support screen readers, keyboard, contrast and error announcements.
- Retention/deletion: define owner-approved retention and deletion/anonymization policy for guest PII, communications, imports and audit events; profile has Remove Personal Data control, effect untested.
- Integration/feature flags: independently gate provider credentials, webhooks and optional package-like features; never allow a provider outage to bypass core authorization.
- Token/session development: one clearly owned area per task, explicit dependencies, acceptance criteria, commands and regression checks; checkpoint roadmap, verification and handoff after every task.

## Deferred evidence

UNKNOWN / NEEDS TESTING: U-001/Q-002 lifecycle writes and allowed transitions; U-009/Q-011 seating-area activation enforcement; alternate-role permissions, payment execution, imports and external delivery. Detailed Reporting parity deferred by product owner. These unknowns must not be presented as confirmed rules.
