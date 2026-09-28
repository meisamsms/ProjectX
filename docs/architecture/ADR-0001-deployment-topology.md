# 0001: Managed modular monolith deployment

Status: APPROVED by product owner, 2026-09-28 (UTC).
Decision IDs: ARCH-D001, ARCH-D015.
Selected option: A.

## Context

The 16 mapped product modules share transactional journeys; fewer deployment boundaries simplify initial delivery. Cloud vendor, regions, service tiers and budget remain unselected.

## Decision

Deploy one managed modular monolith backend and a separately served web client with managed supporting services. Keep strict internal domain module boundaries. Extract a module only when measured operations justify it.

## Consequences and verification

A shared backend deploy cadence requires explicit module boundaries and regression tests.

Verify in the applicable foundation task with isolated data and negative authorization/tenant tests. This ADR specifies architecture only; it adds no application implementation.
