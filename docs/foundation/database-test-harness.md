# Disposable PostgreSQL test harness — DB-HARNESS-001

PROJECTX IMPLEMENTATION CONTRACT. PostgreSQL 16 is the test major; no production database is involved. `pg` is the direct driver, with no ORM selection. GitHub Actions starts an ephemeral PostgreSQL 16 service and injects test-only `DATABASE_URL` and `TEST_DATABASE=1`. The service health check completes before test steps; the job runs `pnpm verify` and blocking `pnpm verify:db`. The service is discarded after the job.

Local development supplies an isolated PostgreSQL database URL, for example `postgresql://user:password@localhost:5432/projectx_test`, and sets `TEST_DATABASE=1`. Database commands set `NODE_ENV=test`. Missing URL fails clearly. The guard requires a PostgreSQL URL, `NODE_ENV=test`, `TEST_DATABASE=1`, and a database name ending `_test`; it never logs URL credentials. These conditions reduce accidental target selection, but developers must still use a disposable database. The test pool is bounded to two connections and closed after use. No Docker requirement applies locally.

- `pnpm db:check` tests a real PostgreSQL connection and version.
- `pnpm db:migrate:test` applies ordered SQL files transactionally and checks SHA-256 against `projectx_test.schema_migrations`.
- `pnpm test:database` runs PostgreSQL smoke, rollback and pool reuse tests.
- `pnpm verify:db` runs migration then tests and requires PostgreSQL. `pnpm verify` remains independent of a local database.

Migration root is `apps/api/migrations/`. Future version-prefixed `.sql` files in task-specific directories, including `people-core/`, are sorted by relative path; use globally ordered directory names. Already applied checksums cannot change. The runner uses one transaction and advisory lock; SQL requiring nontransactional DDL needs a separately reviewed deployment mechanism. The current root has no People migration. The runner and `resetTestDatabase` target only the fixed `projectx_test` schema. Reset drops/recreates that namespace only after the safety guard; callers must serialize destructive reset with other test suites. Current smoke tests use rollback/temp state and do not depend on order or reset. Future suites should reset before loading fixtures and must not run concurrent destructive resets against the same database.

The CI service user owns the disposable test database. Production migration and restricted runtime roles remain future work. This harness does not verify People persistence, RLS, tenant isolation or recovery; those require later physical schemas, restricted roles, and negative tests.
