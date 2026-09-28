# ADR-0007: Foundation toolchain for ProjectX

Status: TECHNICAL DECISION for FOUND-TASK-004, 2026-09-28. Reversible implementation choices under approved ADR-0001–0006; no owner-approved architecture choice changed.

## Decision

Use Node.js 24 LTS (major pinned by `.node-version`), pnpm 11.25.0 workspaces and frozen `pnpm-lock.yaml`; TypeScript 5.9.3 strict; React 19/Vite 8 for a separately served web client; React Router 7 for structural routing; Fastify 5 for the API; TypeScript compiler for API build and `tsx` for development. Use Biome 2 for formatting/linting, Vitest 5 for unit and in-process integration/web tests, Playwright 1.63 with axe-core for browser/accessibility smoke, Fastify's Ajv-powered JSON Schema for API request/response validation and Ajv 8 for environment configuration. The canonical OpenAPI 3.1 specification lives in `packages/contracts/openapi.json`; `openapi-typescript` generates shared types and Swagger Parser validates the spec. A freshness check regenerates into a temporary directory and compares output. No business DTOs or shared domain logic are introduced.

## Rationale and constraints

One tool per job keeps the foundation small. Package versions are exact and the lockfile is committed; development, staging and production use separately validated config. The monorepo contains only web, API and contracts workspace packages. The future PostgreSQL/RLS interface is typed only; physical isolation is not represented as tested. E2E browser binaries are installed separately in CI, and local verification may use `PROJECTX_CHROMIUM_PATH` for an available compatible Chromium binary. This environment uses Node 24.19; production deployments must select a supported patched Node 24 release.

## Consequences

Generated types must be refreshed with `pnpm contract:generate` when the canonical spec changes. `pnpm verify` fails on stale generated types, map references, lint/type errors or failing tests. Browser tests are part of the full gate and cannot be silently skipped. Later domain work may add approved narrow dependencies without moving domain business logic into the contracts package. No deployment provider, ORM, OIDC vendor or migration runner is chosen here.
