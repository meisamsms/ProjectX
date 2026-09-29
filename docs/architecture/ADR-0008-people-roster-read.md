# 0008: Organization roster read boundary

Status: IMPLEMENTED locally for PEOPLE-03; PostgreSQL 16 CI pending.

## Context

SCR-025 shows a User Accounts roster and Access Level filter. The reference does not establish backend ownership, permission behavior, role precedence, sorting or pagination. PEOPLE-03P supplies nullable roster fields, and PEOPLE-02 supplies organization `user.read` authorization and RLS.

## Decision

Expose `GET /api/v1/people/accounts` as an organization roster requiring a trusted server-provided user and organization, the active organization-scoped `user.read` capability, and a restricted runtime transaction under RLS. The application without a trusted binding fails closed. Client query parameters cannot select tenant scope. A venue-only capability does not grant this organization-wide list; venue-specific roster behavior remains an unresolved future decision.

Return only the active membership's user ID, derived nullable name, nullable membership job title, raw nullable notification preference, and sorted distinct names of active organization Role grants. Represent multiple roles as an array without choosing a primary role. Filter by an exact active organization Role name within the authorized rows. Use ascending user UUID ordering, an exclusive UUID cursor, a default page size of 25 and maximum of 100. These are ProjectX decisions, not SevenRooms assertions.

## Consequences and verification

This endpoint does not expose identities, sessions, security metadata or venue grants. The three notification states remain distinct. OpenAPI and generated types describe the response and query. PostgreSQL tests must prove authorized access, RLS isolation, denial paths, filter reduction, nullable values and deterministic pagination before PEOPLE-03 can be VERIFIED. U-002 and other SevenRooms unknowns retain their existing classifications.
