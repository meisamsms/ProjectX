# 0006: Recovery targets and environment separation

Status: APPROVED by product owner, 2026-09-28 (UTC).
Decision IDs: ARCH-D016, ARCH-D018.
Selected option: B.

## Context

The owner selected the operational baseline for the first milestone.

## Decision

Set design targets of RPO 1 hour and RTO 4 hours, not contractual guarantees. Maintain separate development, staging and production environments; CI may create temporary isolated test environments. Require tested restore procedures: a backup is verified only after a successful restoration exercise.

## Consequences and verification

The hosting plan must prove achievable restore procedures against these targets; vendor and costs remain to be chosen without weakening the targets.

Verify in the applicable foundation task with isolated data and negative authorization/tenant tests. This ADR specifies architecture only; it adds no application implementation.
