# 0004: Managed identity and ProjectX authorization

Status: APPROVED by product owner, 2026-09-28 (UTC).
Decision IDs: ARCH-D008, ARCH-D009.
Selected option: A.

## Context

Current-account screens expose venue and permission controls, while alternate-role behavior remains untested. These rules are owner-approved ProjectX requirements.

## Decision

Use a managed OIDC identity provider and secure server-managed browser sessions. ProjectX owns authorization: scoped RBAC plus object-level decisions use authenticated user, Organization, explicit Venue access, permission and target resource. Default DENY. A role name alone is insufficient.

## Consequences and verification

Provider selection, session lifetime and role matrix remain future scoped design and isolated verification work; cookie security, CSRF defense, session rotation and audit apply.

Verify in the applicable foundation task with isolated data and negative authorization/tenant tests. This ADR specifies architecture only; it adds no application implementation.
