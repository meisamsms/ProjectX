# Transaction, concurrency and idempotency contract — FOUND-TASK-003

Status: INFERRED ProjectX contract; operation outcomes in the reference remain UNKNOWN / NEEDS TESTING. No domain workflow or endpoint is implemented here.

## Atomicity

- One authorized transaction binds RLS context, business writes, required local audit row and idempotency completion. Either all locally dependent writes commit or all roll back. For a denied privileged attempt, record a sanitized denial event outside the rolled-back business transaction through an independently scoped append-only audit path; never claim a rolled-back event was committed. If audit is mandatory for a sensitive success and audit insertion fails, fail/roll back the mutation.
- Candidate future transactions: Reservation create with availability/table assignment and idempotency; status change with audit; reassignment with contention check; role/grant/revocation with session/grant-version invalidation and audit; Client merge if approved, with scope and consent reconciliation; import batch/stage commit with explicit partial-row policy. External payments, email, provider callbacks and background messages cannot join the local DB transaction: use durable, idempotent handoff/compensation when that module is implemented. No queue/outbox technology is selected in this task.
- Read-modify-write under stale permission context is forbidden. For access changes, lock/condition the relevant membership/grant versions; revocation must invalidate subsequent requests and queued work. Privileged DB writes, audit and version bump commit together.

## Concurrency by invariant

| Case | Default | Future verification |
|---|---|---|
| Normal mutable configuration/profile edit | Integer `version` optimistic precondition; increment atomically; stale update yields safe 409 or 412 contract. | Two writers, old ETag/version, no lost update. |
| Same Venue/table/time reservation contention | Database-enforced exclusion/unique constraint where domain interval semantics allow, plus targeted row lock or appropriately scoped advisory lock; retry bounded serialization errors. | Concurrent bookings; no double assignment; DST and overlapping durations. Constraint design deferred to Reservations task. |
| Duplicate identity, active membership/access, capability ID, command key | Unique database constraint scoped by tenant and lifecycle. | Concurrent inserts; one winner, safe conflict. |
| Critical access grant/revoke | Single transaction, conditional version and lock where needed. | Revoke while session/job reads; no post-revocation privilege. |
| Multi-row invariant without practical narrower lock | Consider SERIALIZABLE per operation, not global default. | Retry under contention; quantify operational cost. |

`updated_at` alone is not a safe concurrency token if clock resolution or unrelated updates collide; use `version` for mutable aggregates. Later versioned REST/OpenAPI commands must expose a precondition and stable conflict response without exposing foreign-object existence.

## Idempotent command records

For future Reservation creation, imports, payment-adjacent commands, webhooks and retryable jobs, persist a cryptographically nonsecret key namespace bound to Organization, Venue if applicable, operation, actor or trusted integration principal and key; include request fingerprint, state (`IN_PROGRESS`/`SUCCEEDED`/`FAILED_RETRYABLE`), created/expiry instants and safe result reference. A unique constraint on full scope prevents simultaneous duplicates. Same key and fingerprint returns the recorded outcome or a safe in-progress response; same key with a different fingerprint is a conflict. A key from another tenant never finds or replays a result. Expiration is bounded by operation-specific policy, UNKNOWN until modules define retry windows; expiry cleanup must not permit unsafe duplicate financial effects. Secret-bearing raw payloads are not stored in the fingerprint. Test concurrent claims, failed/rolled-back command retries and scoped replay in later tasks.
