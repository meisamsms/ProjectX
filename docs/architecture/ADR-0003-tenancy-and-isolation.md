# 0003: Organization tenancy and defense in depth

Status: APPROVED by product owner, 2026-09-28 (UTC).
Decision IDs: ARCH-D004, ARCH-D006, ARCH-D007.
Selected option: A.

## Context

The owner explicitly established ProjectX tenant boundaries; reference application internal tenant architecture remains unknown.

## Decision

Use PostgreSQL shared schema with explicit tenant keys and Row-Level Security (RLS), plus application authorization. Organization is the primary tenant boundary; a Venue belongs to exactly one Organization. User is one authenticated identity with explicit access to one or more Venues; Organization membership alone confers no automatic Venue access. Each Reservation belongs to one Organization and one Venue. Client identity is Organization scoped and may be recognized across its Venues, never across Organizations. Venue history, notes, preferences, visits and operational metadata remain Venue scoped where appropriate. Only an explicitly permitted Organization level role may read authorized cross-Venue client history. Include organization_id on sensitive records and venue_id on Venue scoped records where appropriate. Deny cross-tenant object access even with a valid object ID.

## Consequences and verification

RLS needs transaction-safe, server-derived scope context, restricted database roles and tests for pool reuse, object-ID swaps and cross-Venue visibility; detailed schema and policy SQL belong to later tasks.

Verify in the applicable foundation task with isolated data and negative authorization/tenant tests. This ADR specifies architecture only; it adds no application implementation.
