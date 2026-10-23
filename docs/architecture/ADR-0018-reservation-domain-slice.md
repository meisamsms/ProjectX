# ADR-0018 — Internal reservation-domain slice

2026-10-17. PROJECTX IMPLEMENTATION DECISION under the explicit owner-authorized
RESERVATION-DOMAIN-001 package. Not SevenRooms evidence. Existing ADR-0003/0004
tenant/permission architecture and production gates unchanged.

## Task-selection gate

PART1; PROCEED on VERIFIED DB-HARNESS-001 and PEOPLE-CORE-01. Implement only an
internal domain service plus minimal persistence and synthetic PostgreSQL16 tests.
Advance search → create → staff read → cancel → available again. No HTTP route,
production test authentication, public guest access, UI, provider setup, modification,
check-in/seating or external confirmation. Existing SETTINGS-CORE-01, CORE-AUTH-02,
RESERVATIONS-CORE-01 and WIDGET-CORE-01 objects/gates are preserved.

## Bounded rules

- Reuse existing organizations/venues and trusted identity + capability transaction
  boundary. Use existing reservation.read/create/cancel permissions with explicit
  current VenueAccess. Synthetic identities are bound only in tests, never routes.
- Configuration is fixture/migration-owner managed, runtime read-only: per-venue
  IANA timezone, active tables with capacity1–50, dated non-overnight shifts with
  local opening/closing minutes, elapsed duration and slot step, party min/max.
  No seat-combination, overbooking, pacing, blackout or recurring schedule engine.
- Preserve Organization-owned Client identity concept. No physical Client exists
  yet: minimal clients hold Organization-scoped identity ID; reservation-owned
  contact snapshot (name + required email) is Venue scoped. No email deduplication
  or inferred identity, directory/history or cross-venue client lookup. A scoped
  successful creation creates one client and reservation atomically.
- UTC instants are canonical; venue-local date and IANA timezone retained.
  Generate slots on the UTC timeline between timezone-resolved shift boundaries.
  Elapsed durations/steps; DST gaps yield no nonexistent times, repeated times
  are distinct UTC slots. PostgreSQL resolves ambiguous shift boundaries to
  standard time; nonexistent shift boundaries yield no bookable slots through round-trip checking.
  Reject starts not in configured slots, past slots and invalid dates/timezones.
- One active reservation per overlapping table interval, half-open [start,end).
  PostgreSQL btree_gist UUID + tstzrange exclusion constraint is final protection,
  including raw writes/concurrent connections. Shared-lock configuration rows and
  recheck configuration/capacity in persistence trigger. Configuration remains
  immutable to runtime. Cancellation changes only BOOKED→CANCELLED; no reactivation.
- Idempotency unique by Organization/Venue/actor/key; compare normalized command
  fingerprint, replay the same record (even cancelled), reject changed payload.
  Keys retained for record lifetime, no TTL reuse. Different keys still compete
  through allocation constraint. No automatic unbounded retry.
- Safe typed domain errors, no SQL/PII logs. Successful create/cancel metadata
  written by narrow trigger-owned audit path in the same transaction; runtime
  cannot write/update/delete audit. No generic audit/Export subsystem. Denials
  return safely; durable denied-attempt audit is not claimed by this local slice.
- New tables have RLS with actual capability checks, explicit tenant/Venue scope
  and composite ownership FKs. Existing restricted non-owner runtime role, no
  BYPASSRLS/admin request pool. Test pool has multiple real connections for races.

## Owned integration dependencies

New migration follows existing sorted migration directories; no existing SQL
changed. Register focused suite in existing database runner so full verify:db
cannot omit it. Domain contracts are internal TypeScript, not HTTP/OpenAPI DTOs.
Entity registry records physical slice separately from reference confidence.

2026-10-22 verification exposed exact whole-ledger expectations in five existing
People regression files (Booked By, Server Names, direct grants, RLS and roster
fields). RESERVATION-DOMAIN-001-REGRESSION-001 records this required integration
dependency. Append the exact new migration name to those five lists, retaining
checksum equality, upgrade preservation and privilege assertions. No People
runtime logic or historical migration changes are required. The domain migration
test also compares columns, constraints and RLS policies before/after reapplication.

## Acceptance / verification

Focused real PG16 tests: available/full/invalid slots, create/read/list/cancel,
overlap/concurrency/adjacency, same/different-key retry, Organization/Venue denial,
permissions/revocation/raw RLS, DST gap/fold, invalid zone/date, rollback/audit,
migration clean/upgrade, and executable synthetic complete-flow demonstration.
Then pnpm verify, pnpm verify:db, map/diff and history preservation checks.
No core readiness claim: public access, browser integration, confirmation delivery,
modification/check-in/seating and production provider verification remain unmet.

PostgreSQL16 primary references: [range exclusion constraints](https://www.postgresql.org/docs/16/rangetypes.html)
and [invalid/ambiguous timestamp resolution](https://www.postgresql.org/docs/16/datetime-invalid-input.html).
