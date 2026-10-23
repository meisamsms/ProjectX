# ProjectX

Independent functional reimplementation of an authorized reference application.

## Current state

Phase 04: core domain implementation. The React web shell, Fastify API, shared OpenAPI contracts, People workflows, and staff authentication integration exist. The internal reservation-domain slice is locally VERIFIED: search, create, authorized staff reads, cancellation and restored capacity pass PostgreSQL 16 tests. It is not connected to booking HTTP routes or browser screens. The integrated reservation readiness gate remains unmet.

Read [the current handoff](docs/project-map/handoff.md) and [the domain contract and executable demo](docs/data/reservation-domain.md) before continuing. CHK-081 in [verification.json](docs/project-map/verification.json) records final local gates. The [October 20 readiness review](docs/project-map/readiness-2026-10-20.md) is retained as historical evidence.

## Local verification

Use Node.js 24 and pnpm 11.25.0. `pnpm verify` checks formatting, lint, types, unit/authentication/API/web tests, OpenAPI and map consistency, browser tests, and builds. Playwright needs a compatible Chromium installation.

`pnpm verify:db` is a separate required gate using an isolated PostgreSQL 16 database, `DATABASE_URL`, and `TEST_DATABASE=1`; the database name must end in `_test`. Tests reset the fixed test schema. See [the database harness contract](docs/foundation/database-test-harness.md) for safeguards; its original scope notes are historical.

The Vite development server alone does not connect staff authentication or proxy API requests. Live staff operation needs the approved same-origin gateway, provider configuration, and restricted database runtime. Existing browser tests use synthetic API responses and do not prove a live guest-to-staff reservation flow.

## Working method

Read [AGENTS.md](AGENTS.md) before making changes. Record observed behavior in `docs/project-map/app-map.json` with stable IDs, evidence, and one of `CONFIRMED`, `INFERRED`, `UNKNOWN`, or `NEEDS TESTING`. Track scope and dependencies in `roadmap.json` and `dependencies.json`; record decisions in `decisions.json` and architecture decisions in `docs/architecture/ADR-XXXX-*.md`. Record completed checks in `verification.json` and leave the next exact task in `handoff.md`.

Implementation lives in `apps/web`, `apps/api`, and `packages/contracts`; migrations live in `apps/api/migrations`, with verification tooling in `tooling` and browser checks in `tests/e2e`. Architectural boundaries are recorded in `docs/architecture`.
