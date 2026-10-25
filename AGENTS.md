# ProjectX AGENTS.md — Core-First, Low-Usage

## Mission and guardrails

Independently recreate the reference application's **observable** functionality using only authorized screens, workflows, and normal-use API/network behavior. Do not access or copy proprietary code, algorithms, protected assets/text, credentials, keys, secrets, or unauthorized data. Observed behavior informs requirements, not internal architecture.

Apply owner Master Rules, existing decisions, and security/release gates. **No production implementation without task-specific authorization.** These instructions do not authorize provisioning, Git publication, or deployment. Preserve working behavior, confirmed findings, evidence, and Git history.

## Priority and scope

- **P1:** reservation widget; date/time/party-size search; availability, shifts/rules, capacity/tables, timezone/DST; guest records; create/change/cancel, confirmation; staff book, check-in/seating; atomic double-booking prevention. Advance the smallest dependency-ready end-to-end slice.
- **P2:** auth, permissions, tenant/venue isolation, RLS, database, users/settings, and security only when P1 requires them; reuse verified foundations.
- **P3:** exports, analytics, advanced reports, optional admin/integrations, cosmetic features. Defer unless authorized or essential to P1.

Follow the approved roadmap phase and dependencies; do not build the whole app, change unrelated modules, or replace working paths unnecessarily.

## Context and evidence

At a new task/session, read this file and the latest `docs/project-map/handoff.md`; check branch, HEAD, and worktree if available. Consult **relevant sections**, not full repeated scans, of `roadmap.json`, `app-map.json`, `decisions.json`, `verification.json`, ADRs, code, and tests. Follow repository paths and stable task IDs. Recheck changed, uncertain, or gate-critical facts. Never rely solely on chat history or assume undocumented behavior is absent.

Use stable IDs for screens, flows, APIs, entities, permissions, and rules; cross-reference findings. Label each `CONFIRMED`, `INFERRED`, `UNKNOWN`, or `NEEDS TESTING`; keep evidence and unresolved questions. Document reasons before revising confirmed findings.

## Authorized work package

Specify **TASK ID, outcome, dependencies, IN/OUT scope, boundaries, acceptance criteria, required verification, docs, and stop conditions**. Without implementation authorization, only propose/discover. Once authorized, complete applicable implementation, tests, in-scope fixes, documentation, and **permitted** local commit together; do not request approval for every internal step. Prefer one agent and one bounded package; split only for real dependencies, risk boundaries, or tool limits.

For an unexpected dependency, record its ID, reason, affected modules, and predecessor; never implement it outside scope. Continue only if safely independent; otherwise mark `BLOCKED`.

## Security, costs, release

Preserve PostgreSQL RLS and venue/tenant authorization, safe guest access, secure auth/session/cookies/CSRF/origin/Host, capacity/concurrency, timezone/DST, required audits, personal data, and secrets. No synthetic auth outside isolated development/tests; mocks are not provider verification.

**Infrastructure budget $0.** No paid services, cards/trials, domains, or provisioning without approval. A live Auth0/HTTPS block does not stop independent, demonstrably safe local-only reservation work. Rejected Quick Tunnel real-OAuth remains blocked; `LOCAL-004`/stunnel is parked unless critical. Preserve `D004–D008`, `CHK` history, SevenRooms evidence. Never force-push, rewrite approved commits, merge main, publish, expose, or deploy without specific authorization; honor exact-SHA rules.

## Verification and completion

Run focused tests during development; run applicable required lint, typecheck, unit, integration, DB, API-contract, security/RLS, concurrency, timezone, E2E, regression, and full-suite checks at their **required gates**, not after trivial edits. Reuse valid evidence only when unchanged and permitted; never replace required new tests. Fix in-scope failures; record failures, unknowns, and blocked provider gates. Demonstrate the guest-to-staff flow when required.

Statuses: `NOT_DISCOVERED`, `DISCOVERED`, `DOCUMENTED`, `PLANNED`, `BLOCKED`, `READY`, `IN_PROGRESS`, `IMPLEMENTED`, `VERIFIED`, `DONE`. Code alone is `IMPLEMENTED`; `VERIFIED`/`DONE` require successful applicable tests/evidence, demonstration, docs, and approvals. Do not call an unverified phase complete.

## Documentation and handoff

Update affected master records **once per meaningful step**, batching `docs/project-map/roadmap.json`, `verification.json`, `handoff.md` and relevant maps/decisions. Record critical blockers immediately; never erase evidence or perform no-op rewrites. Create `docs/architecture/ADR-XXXX-*.md` for actual architectural decisions.

Keep handoff concise: `CURRENT PHASE`, `CURRENT TASK`, `STATUS`, `COMPLETED`, `FILES CREATED`, `FILES MODIFIED`, `TESTS EXECUTED`, `TEST RESULTS`, `UNRESOLVED ISSUES`, `NEXT EXACT TASK`, `FILES NEXT AGENT MUST READ`; include branch/SHA/approvals when relevant.

Choose the next dependency-ready P1 task from the roadmap; don't ask “What next?” If an owner decision is needed, present the question, impact, practical options/trade-offs, recommendation, and mark `BLOCKED`. Stop for missing authorization, safety/scope risks, blockers, or mandatory approvals.

**Final report:** delivered behavior, demonstrated tests/results, failures/risks, changed files, permitted commit SHA, updated status/docs, next P1 task, approvals needed. No large logs, repeated history, or needless agent handoffs.

**Optimize AI usage per safely verified P1 feature—not by skipping safeguards.**
