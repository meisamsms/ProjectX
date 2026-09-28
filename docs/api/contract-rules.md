# API and shared-contract rules — ARCH-001

Status: PROPOSED requirements. API style and validation authority await owner answer to ARCH-D010/D011. No endpoint, schema, runtime validator, framework or generated client is implemented.

| Contract concern | Rule for future implementation |
|---|---|
| Versioning | Explicit compatible contract version and documented breaking-change policy; never silently change field meaning. |
| Authentication context | Resolve identity from verified server-side session/token, never request body or URL. |
| Tenant context | Derive authorized organization/venue scope and compare with selected venue and object ownership; reject mismatches. Exact hierarchy awaits ARCH-D004/D006. |
| Authorization | Check action permission plus resource/venue ownership on each command, query, export and background job. |
| Request validation | Strict schema, bounded sizes, allowlisted fields and explicit unknown-field policy; error responses include safe field references. |
| Response envelope | Keep success representation consistent within selected API model; do not add redundant envelope without a proven need. |
| Errors | Stable machine code, HTTP status where applicable, safe message, correlation ID, optional field issues and retry hint; no PII or internals. |
| Pagination | Bounded page/cursor size with stable ordering, total count only where affordable and authorized. |
| Filtering/sorting | Document supported fields and operators; allowlist ordering; deterministic ties and tenant scope before search. |
| Idempotency | Required for reservation create/change, payments, imports, message delivery and webhook retries; scoped to actor/tenant/venue and operation with stored result/TTL policy. |
| Concurrency | Version or conditional update for mutable reservation/shift/table configuration; exact conflict rule tested with isolated fixtures. |
| Dates/times | ISO-8601 absolute instants with offset/UTC for events; explicit venue time zone plus local service date for shifts/calendars; DST tests. |
| IDs | Opaque stable identifiers, explicit object type and tenant-scope authorization; do not rely on ID opacity alone. |
| Money | Integer minor-unit amount and ISO currency with explicit rounding/fee contract if money flows are enabled; no client-only authoritative totals. |
| Audit metadata | Actor, venue, correlation/idempotency key, timestamp and change reason as appropriate; redact PII and secrets. |
| Background/event contract | Explicit producer/consumer version, replay/idempotency, minimal tenant context and least-privilege worker recheck; broker deferred. |
| Webhook contract | Provider authentication, timestamp/replay validation, signed payload, version, idempotency and quarantine for unknown fields. |

## Independent-task gate

Every API-related roadmap task must own a narrow resource or workflow: contract/schema → data boundary → domain invariant → handler → client → screen → isolated integration verification. Its acceptance report must identify dependencies, affected roles/venues, error paths, verification commands and regressions. This is a proposed work decomposition, not an assertion about SevenRooms' endpoints.

UNKNOWN / NEEDS TESTING: allowed status transitions, actual reservation and payment success/failure, cross-venue client sharing and alternate-role permissions. Keep placeholders explicit until test fixtures or owner policy provide evidence.
