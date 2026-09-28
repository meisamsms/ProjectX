# PostgreSQL RLS policy model — FOUND-TASK-003

Status: INFERRED ProjectX policy templates under APPROVED ADR-0003. These are conceptual patterns, not executable migration SQL. All policy effects are NEEDS TESTING with real PostgreSQL. Reference application RLS is UNKNOWN.

| Category | SELECT (`USING`) | INSERT (`WITH CHECK`) | UPDATE (`USING` + `WITH CHECK`) | DELETE (`USING`) |
|---|---|---|---|---|
| ORGANIZATION_ISOLATED | Organization key equals verified transaction Organization; separately authorized organization operation. | New Organization key must match context. | Existing and resulting Organization keys must match; immutable tenant key. | Default DENY; specific authorized operation only. |
| VENUE_ISOLATED | Organization AND Venue keys match verified context; active explicit Venue Access and capability checked server-side. | Both keys match; composite Venue FK valid. | Existing and resulting pairs match; disallow scope move. | Default DENY; explicit permission plus lifecycle check for exceptional tables. |
| ORGANIZATION_SHARED_VENUE_PROTECTED | Shared Client identity read under validated Organization and minimum fields; venue child/history read only with matching Venue Access OR a separately authorized organization-level cross-Venue history path. | Parent Client Organization key matches; Venue children also match composite parent/Venue scope. | Existing and resulting keys match; shared identity changes require explicit organization-appropriate authority, venue child only Venue-specific authority. | Default DENY; privacy/anonymization workflow separately reviewed. |
| SELF_ONLY | Verified User ID equals row owner ID (or approved subject binding); no tenant-free broad scans. | Owner equals verified User where self-created rows permitted; otherwise DENY. | Existing and resulting owner ID match, protected columns immutable; otherwise DENY. | Default DENY except session revocation/expiry path. |
| PLATFORM_ADMIN | Not enabled. | Not enabled. | Not enabled. | Not enabled. |

`USING` filters rows eligible for SELECT/UPDATE/DELETE; `WITH CHECK` validates rows inserted or the post-update image. BOTH are required for writes so an actor cannot move a row into another tenant even if they could see its old state. Table grants and application authorization are additional gates; RLS cannot replace capability/field policy. For Client identity, prefer separate restricted projections/read endpoints for venue-only minimum fields because row-level RLS alone cannot hide columns. A generic Organization Client SELECT must not expose all fields to a Venue user merely because Organization ID matches. Do not let a forged `app.access_mode` bypass capability verification; it is only set inside a server-authorized operation, and privileged org-wide history must be isolated from normal Venue queries. Physical policy helper trust and direct SQL threat model must be checked before implementation.

## Policy deployment and coverage

Every tenant table receives an explicit category, SELECT/INSERT/UPDATE/DELETE review, tests with Organization/Venue fixtures and `FORCE ROW LEVEL SECURITY` where appropriate. Tables without approved policy category remain inaccessible to runtime by default. Grant only required SQL verbs; UPDATE must not permit tenant key changes. Foreign keys and uniqueness constraints enforce ownership even where a policy filters reads. Count table/policy coverage at each migration; migrations that add tenant tables must include tenant keys, policy, FORCE setting and negative tests in the same review. Changes to privileged views, materialized views, SECURITY DEFINER routines or report refreshers require separate access review. Owners/migrations do not serve app requests.

| Database role | Allowed purpose | Bypass, audit and environment guard |
|---|---|---|
| Schema owner / migration | DDL and controlled backfills | May bypass normal RLS only during reviewed deployment, never exposed to runtime; log migration identity, scope, SQL provenance and outcome in dev/staging/prod. |
| Application runtime | Minimum DML through authorized transactions | No BYPASSRLS, no schema ownership/DDL; fail on missing context; automated cross-tenant checks. |
| Reporting/read-only (only if needed) | Selected RLS-protected read models | No bypass by default; read-only grants, explicit scope, two-tenant negative tests; creation deferred. |
| Background worker (only if needed) | Narrow job-specific operations | Runtime-equivalent RLS and revalidated actor/scope, separate least-privilege credentials if necessary; no inherited request connection. |
| Backup/restore operator | Encrypted backup and isolated restore | Privileged access only in approved administrative environment, limited operator, audited invocation and restore rehearsal; no request-time use. |

Any exceptional BYPASSRLS requires a separately documented purpose, named operational owner, restricted environment/credential, audit of use and negative coverage showing no user-facing path reaches it. No silent admin bypass and no platform administrator policy is approved.
