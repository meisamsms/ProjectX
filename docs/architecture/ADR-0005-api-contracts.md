# 0005: Versioned REST and OpenAPI contracts

Status: APPROVED by product owner, 2026-09-28 (UTC).
Decision IDs: ARCH-D010, ARCH-D011.
Selected option: A.

## Context

An explicit API seam supports the approved separately served web client and typed monorepo.

## Decision

Use versioned REST APIs with OpenAPI as the contract, server runtime validation, and generated TypeScript client/types. The frontend consumes generated or contract-derived DTOs, not manually duplicated definitions. Define uniform errors, pagination, filtering, sorting, IDs, dates and times, idempotency, concurrency and audit metadata. Introduce dedicated read endpoints/models for complex screens as needed.

## Consequences and verification

Generation and validation must stay synchronized in CI; detailed endpoint shapes and runtime validation library belong to implementation tasks.

Verify in the applicable foundation task with isolated data and negative authorization/tenant tests. This ADR specifies architecture only; it adds no application implementation.
