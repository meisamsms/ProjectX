CURRENT PHASE: PHASE-04 Core domain implementation — IN_PROGRESS.
CURRENT TASK: CORE-AUTH-D008 — Localhost HTTPS verification authority and trust policy.
STATUS: DOCUMENTED; decision APPROVED / OWNER APPROVED / PROJECTX DEPLOYMENT DECISION. CHK-077.
COMPLETED: Recorded explicit Option A: exact https://localhost:8443 origin, /api/v1/staff-auth/callback callback and / post-logout root; current-user-only reversible trust; mkcert preferred certificate candidate; stunnel first terminator candidate to review. Development verification only; D004-D007 and CHK-075/076 preserved.
FILES CREATED: None.
FILES MODIFIED: docs/project-map/{decisions,roadmap,verification}.json; docs/project-map/handoff.md; docs/architecture/ADR-0017-zero-cost-provider-verification.md; docs/security/staff-session-verification.md.
TESTS EXECUTED: pnpm map:check; git diff --check; JSON/unique IDs/DAG and exact historical/VERIFIED/decision/reference/scope comparisons.
TEST RESULTS: PASS map (144 screens/16 modules/59 tasks), diff, JSON/unique IDs/DAG, all76 priorCHK/all30 prior decisions/26 VERIFIED/57 unrelated tasks and reference preservation, six-doc scope and secret check. No runtime/browser/provider/transport tests or setup. Prior base CI run38192015438/job114626603571 passed both gates, DB210/210 across21 files, PG16.15; not CI for this new commit.
UNRESOLVED ISSUES: D008 publication/green CI and separate LOCAL-004 execution authorization; exact supported tool versions/artifact integrity/bounded commands; genuine browser trust/HTTP/log/cookie/authority proof; gateway localhost:8443 incompatibility; deterministic multi-instance routing; actual Auth0 Free and restricted PostgreSQL16 environment checks.
APPROVAL BOUNDARY: No installation, root CA/certificates/trust changes, listeners, service/startup, public/LAN exposure, accounts, ProjectX/Auth0/PostgreSQL, real OAuth, spend or code changes. No machine-wide trust/TLS bypass. Elevation/restart require separate approval. localhost-only SAN; no alternate hostname/IP/port/wildcard. STOP if current-user trust or stunnel safety cannot be satisfied; no silent Caddy switch.
TRUST LIFECYCLE: Future authorized fake test must inventory trust, add minimum current-user temporary trust, create only required test certificate, test, stop processes, remove test cert/added trust/key/config, verify cleanup and retain sanitized evidence only.
QUICK TUNNEL: NOT APPROVED for real callbacks; CHK-075 public HTTP forwarding/error-query disclosure unchanged. No suppression fix or rerun.
PRIORITY PART: 2 — REQUIRED FOUNDATION.
CORE WORKFLOW ADVANCED: Trusted staff authentication before reservation-required Venue settings and staff reservation book/check-in/seating.
CORE READINESS GATE: UNMET — CORE-READY-01.
REQUIRED FOUNDATION DEPENDENCIES: CORE-AUTH-01/PEOPLE-CORE-01 VERIFIED; CORE-AUTH-02 IMPLEMENTED; LOCAL-001 BLOCKED; LOCAL-GATE-001/002 BLOCKED; LOCAL-GATE-003 BLOCKED / NEEDS ACCOUNT CHECK; provider NEEDS TESTING; ENVIRONMENT READY NO.
DEFERRED SECONDARY TASKS AND REASONS: D005 future paid Render retained/deferred under D007 $0; PEOPLE-09 READY / PART3 DEFERRED; PEOPLE-09B/10 PLANNED / DEFERRED; SETTINGS-CORE-01 PLANNED awaiting VERIFIED authentication; IMPL-MOD-14 IN_PROGRESS.
TASK-SELECTION GATE: D008 / Part2 / PROCEED documentation only under explicit owner selection. Own six policy/status docs; no implementation. Acceptance: exact policy and execution limits, preserved history/gates, validation and one local child commit. Regression: all76 prior checks/26 VERIFIED tasks/D004-D007/reference evidence unchanged.
SEVENROOMS TRACK: All classifications and U-001/U-002/U-003 unchanged; no new reference evidence or parity.
NEXT EXACT TASK: CORE-AUTH-02-ENV-LOCAL-004 — Disposable localhost HTTPS transport verification.
NEXT EXACT CORE TASK OR REQUIRED PREDECESSOR: Separate exact-SHA D008 publication approval and green CI, then separate explicit LOCAL-004 execution authorization. LOCAL-004 remains PLANNED. Fake app only initially; successful inert proof is necessary but insufficient for real setup.
FILES NEXT AGENT MUST READ: AGENTS.md; docs/project-map/{decisions,roadmap,verification,dependencies}.json; ADR-0017 CHK-075/076/077; docs/security/staff-session-verification.md; existing gateway/auth contracts before any future integration.
PUBLICATION: One documentation-only local child of a5deb1211b57302363eee5e657c297f499f17d33; no push. Separate exact-SHA approval required.
