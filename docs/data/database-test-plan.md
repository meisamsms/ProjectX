# Future database verification plan — FOUND-TASK-003

Status: NEEDS TESTING when a PostgreSQL test harness and schemas exist. This task runs document validation only; the cases below are acceptance contracts, not passed runtime tests. Use disposable fixtures, never live reference records.

## Fixture graph

ORG-A owns VENUE-A1 and VENUE-A2; ORG-B owns VENUE-B1. Include an Organization admin with explicit cross-Venue Client history grant, Venue-only employee at A1, cross-Venue employee with explicit A1/A2 grants, revoked member, revoked Venue Access, disabled User and user with no permissions. Make same-shaped object IDs/names and overlapping client search terms, but preserve global UUID uniqueness. Seed shared Client identity at ORG-A, separate Venue A1/A2 notes/history, and unrelated ORG-B Client. Isolate dev seeds, test fixtures and production bootstrap.

| Gate | Negative and positive cases | Pass condition |
|---|---|---|
| Constraints / FKs | Wrong Organization/Venue composite FK; duplicate OIDC issuer+subject; duplicate active membership, access, permission and scoped key | Invalid rows rejected; valid multi-Organization user and distinct Venue grants accepted. |
| RLS SELECT | A1 vs A2; ORG-A vs ORG-B; same known foreign ID; own User vs other User; shared Client identity vs venue notes | No unauthorized row or field; approved org-wide history path only with capability. |
| RLS INSERT and `WITH CHECK` | Missing context, forged Organization/Venue pair, wrong Venue parent, foreign ClientVenueProfile | Reject all mismatched inserts; authorized pair succeeds. |
| RLS UPDATE | Existing row visible but change tenant/venue; wrong target and missing `WITH CHECK` | No scope move or update; authorized same-scope version update succeeds. |
| RLS DELETE | Default-denied sensitive row, wrong tenant, authorized lifecycle exception | Denied by default; only explicitly reviewed deletion succeeds. |
| Context integrity | Missing/malformed settings, user/tenant spoof from request, org-only mode on venue table | Fail closed without leaking tenant existence. |
| Pool leakage | Transaction A sets ORG-A then commits/rolls back; transaction B reuses connection as ORG-B or without scope; aborted query and savepoint | B never reads A; no context survives transaction boundary. |
| Access revocation | Membership, Venue Access, User disabled or permission changed while session/worker queued | Next protected operation denied; stale grant version cannot authorize. |
| Transactionality | Booking, grant/revoke, local audit insertion and idempotency fail midway | All local writes roll back; denied attempt audit separately durable where required. |
| Concurrency | Two updates with same version; concurrent membership inserts; table/time contention | No lost update, duplicate active grant or double booking. |
| Migration | Clean install; previous-version upgrade; interrupted nontransactional step; RLS policy/grant diff | Same intended schema and denied access after each supported path. |
| Idempotency | Duplicate same key/payload; changed payload; cross-tenant same key; concurrent same key | One effect, correct same-scope replay and mismatch conflict, no cross-tenant replay. |
| Backup/restore | Restore encrypted backup to isolated staging; replay to target time; test policy/keys | Verified data integrity and measured RPO/RTO against design targets. |

Security review also verifies the runtime role lacks BYPASSRLS and DDL/schema ownership, privileged credentials are not reachable from request paths, append-only audit cannot be updated/deleted by runtime, secrets are never logged, and PII is not copied into fixtures. Index verification begins with scoped Organization/Venue + operational filter, FK and unique-constraint indexes; EXPLAIN on measured query patterns drives final choices. Candidate indexes: `(organization_id, venue_id, service_date/status)` for later Reservation needs, `(organization_id, client lookup key)` with privacy-aware search, and scope-leading FK indexes. These are NEEDS TESTING, not final index definitions.

Runtime tests, restore drills, performance checks and migration rehearsals remain downstream implementation gates; no database instance was changed in FOUND-TASK-003.
