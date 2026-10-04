# ADR-0015: User Accounts Export contract

Status: accepted specification only, 2026-10-04. OWNER APPROVED / PROJECTX IMPLEMENTATION DECISION — PEOPLE-D009. No export implementation or runtime verification.

## Context and evidence boundary

The owner chose explicit ProjectX specification instead of further SevenRooms
Export discovery. ACT-0056 remains CONFIRMED as a visible action only. Reference
file format, fields, tenant scope, filters, permissions, delivery/download, filename,
audit, retention, failure/cancellation and alternate-role behavior remain
UNKNOWN / NEEDS TESTING. Preserve U-001/U-002/U-003; no parity or internal-design claim.

PEOPLE-03 is VERIFIED but its actual GET contract is an organization roster under
`user.read`, not a current-Venue roster. This export deliberately narrows that
domain to accounts with active membership/access in the trusted current Venue.
The existing organization read endpoint, source field meanings and ascending User
UUID ordering remain unchanged. Do not reuse its organization-wide response as
the export or export only one paginated/filtered UI page. Access Level retains
the source role-display semantics, not a new role precedence/permission decision;
nullable source values must not be replaced by guessed defaults.

## Approved contract

- CSV, UTF-8; immediate synchronous HTTP download. No stored export job or
  generated server-side file retention.
- Complete authorized current-Venue roster from the PEOPLE-03 domain; no v1
  filters. Organization/Venue authority comes solely from trusted server context,
  never client IDs, headers, body or query selections treated as authority.
- Exact columns in order: `Name`, `Job Title`, `Access Level`, `Email Notifications`.
  Exclude Email, Mobile MFA, Suspended internals, Granular Permissions, Email
  Subscriptions, Organization/Venue/User IDs, AuthenticatedIdentity identifiers,
  OIDC issuer/subject, internal Role/Permission IDs and audit metadata.
- Introduce explicit VENUE capability `people.accounts.export`; ordinary roster
  read authority never implies export authority. Recheck active identity,
  membership, VenueAccess and scoped grants through the existing server boundary.
- `POST /api/v1/people/accounts/export`, strict body `{}`; no filters or tenant
  parameters. HTTP 200, `Content-Type: text/csv; charset=utf-8`,
  `Content-Disposition: attachment; filename="people-accounts-YYYY-MM-DD.csv"`.
- Ascending User UUID order follows the ProjectX roster, not claimed reference
  behavior. Maximum 10,000 rows; above the limit return safe 422 without a partial
  export. An empty authorized roster returns the four-column header only.
- Neutralize exported text beginning with formula/control prefixes including
  `=`, `+`, `-`, `@`, tab and carriage return. This is a ProjectX security decision;
  CSV escaping/quoting and prefix neutralization must both be tested, without
  altering source records. Apply to each exported text cell, including role text.
- Audit scoped attempt/result using existing append-only/redacted conventions:
  only event type, organization scope, venue scope, actor attribution, timestamp,
  success/denied/failed result and exported row count on success. Never audit/store
  CSV contents or exported field values. Missing unauthenticated actor/context
  must not be fabricated or supplied by the client. Generated CSV retention is
  none; existing audit-metadata retention policy is not changed by this decision.
- Safe errors: 400 malformed request, 401 unauthenticated, 403 missing export
  capability, 422 row-limit exceeded, 500 generic generation failure. Use existing
  safe error conventions, never raw SQL, PII, CSV fragments or foreign existence.
- Complete generation and required audit success before sending CSV headers/body;
  failure must not send/store a partial export. Do not claim successful client
  receipt from the server-side generation/result event.

## Narrow future dependencies and verification

PEOPLE-09 owns the export backend only. Its verified prerequisites are PEOPLE-03
(roster domain) and the transitive PEOPLE-02 authorization/RLS foundation. The
required integration seams are canonical capability registration/grants, narrowly
scoped read/RLS access for the existing roster domain, metadata-only audit and
the new API contract. Existing `user.read` and its endpoint must not be widened,
existing grants must not automatically gain export, and migration-owner runtime
connections or broad RLS bypass are prohibited. This task records those seams;
it does not implement them or select physical audit/migration architecture. If a
future implementation requires an unrelated dependency, stop and record it first.

Future acceptance must prove exact columns/UTF-8/headers/filename, empty and
10,000/10,001 boundaries, complete pagination-independent ordering, nullable/multi-
role source semantics, CSV escaping and all formula prefixes, explicit export
grant positive/negative cases, wrong-Venue/cross-Organization/revoked/disabled/raw
RLS and pool-reuse cases, strict `{}` and safe 400/401/403/422/500, metadata-only
audit and generation/audit failure atomicity on real PostgreSQL 16. Run repository
`pnpm verify` and `pnpm verify:db` plus focused export/contract tests before VERIFIED.

PEOPLE-09 is READY because its specification prerequisite is resolved, not because
export is built/tested. PEOPLE-09B remains PLANNED and separate; PEOPLE-10 remains
PLANNED, IMPL-MOD-14 IN_PROGRESS. SCR-025 Export stays unavailable until its backend
and frontend gates pass. No narrower milestone or module-completion claim.
