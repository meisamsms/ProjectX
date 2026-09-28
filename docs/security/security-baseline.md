# Security baseline and threat boundaries — ARCH-001

Status: PROPOSED security requirements for ProjectX; no implementation or reference-app vulnerability assessment. Confirmed product evidence includes venue/user access controls (SCR-025/026), guest profile and removal control (SCR-140/141), imports (SCR-089), reservation and payment-adjacent actions (SCR-003/139), and activity history. Actual alternate-role permissions and write effects remain UNKNOWN.

## Architectural protections

- Authentication: choose identity/session owner in ARCH-D008; use MFA support for privileged users, secure recovery, session rotation/revocation, short idle limits appropriate to service operations, and no credentials in browser storage/logs.
- Authorization: server-side deny by default on every route, command, resource and export; resolve actor, organization and venue separately; never trust a route parameter or client-supplied role as authorization.
- Tenant isolation: choose ARCH-D004/D006/D007. Scope all queries, jobs, search, imports, reports, storage keys and audit events; assert object ownership after lookup. Test two tenants and two venues with matching object-shaped IDs.
- PII: minimize collection, field-level access, encryption in transit and at rest, redacted logs, retention and verified deletion/anonymization process. Never copy live guest data into fixtures.
- Secrets: managed secret storage, least-privilege service identities, rotation and leak detection; no secrets in git, client bundles, URLs, exports or trace fields.
- Audit: append-only actor/venue/object/event metadata with tamper-evident retention controls; never treat mutable comments as the sole security audit trail. Restrict read access and record privileged audit queries.
- Validation and database access: server-owned schemas, allowlisted fields, bounded sizes, parameterized queries and safe error messages. Reject mass assignment of status, role, tenant and financial fields.
- Rate limiting: per actor, venue, IP and sensitive action where applicable; throttled sign-in, guest search, booking, imports and webhook endpoints with predictable retry behavior.
- Integrations/webhooks: verify provider signatures and timestamps, replay windows, idempotency keys and scoped credentials; quarantine unknown payloads and never trust provider claims for authorization.
- Logging: structured correlation IDs without tokens, payment information, full guest contact details or raw import rows; access-controlled retention.
- Import/export: preflight file type/size, scan and quarantine, staged validation, tenant ownership, dry-run/summary, duplicate handling, transactional or compensating commit, authorization and audit; exports require explicit scope, privacy checks and expiry.
- Backup/recovery: encrypted backups with separate credentials, access control, restore rehearsals and owner-approved RPO/RTO (ARCH-D016); deletion and retention policy must account for backups.
- Browser: content security policy, output encoding, same-site secure cookies and CSRF defense for cookie-authenticated mutations; accessibility and error states verified without leaking data.

## Preliminary threat-boundary analysis

| Design threat (not a finding) | Boundary | Required architectural control and verification |
|---|---|---|
| Cross-tenant access | Organization data boundary | Tenant context bound server-side; database enforcement choice; negative two-tenant tests. |
| Cross-venue access | Venue-scoped records and user memberships | Verify venue membership and object ownership on each request, job and export; cross-venue tests. |
| Privilege escalation | Role/permission changes | Deny by default, privileged approval/audit and server-side permission checks; lower-role tests. |
| IDOR/object authorization | Guest, reservation, table, file and report IDs | Object-scope check after lookup; unguessable IDs alone are insufficient; swapped-ID tests. |
| Session theft | Browser/identity provider | Secure HttpOnly SameSite cookies or equivalent approved strategy, rotation, MFA, revocation and anomaly detection. |
| CSRF where applicable | Cookie-authenticated mutations | CSRF tokens or robust same-site/origin verification; cross-site request tests. |
| XSS | User notes, names, templates and report labels | Contextual output encoding, CSP, sanitized rich text and malicious-input tests. |
| SQL injection | Search/filter/sort and imports | Parameterized data and allowlisted sort/filter fields; fuzz tests. |
| Mass assignment | Forms and API command payloads | Explicit input schemas and authorization for sensitive fields; unknown-field tests. |
| Unsafe imports | Uploaded client/reservation files | Quarantine, scan, field validation, preview, dedupe, tenant scope and rollback; malicious-file tests. |
| Webhook spoofing/replay | External providers | Signature, timestamp, replay and idempotency verification; fake-provider tests. |
| Secrets exposure | Build/deploy/log/browser boundaries | Managed secrets, secret scanning and redaction; build-artifact review. |
| Audit-log tampering | Privileged event trail | Append-only write path, separate access and integrity checks; mutation denial tests. |
| PII leakage | Guest profiles, messages, exports, backups | Least privilege, field minimization, redaction, scoped exports and retention tests. |
| Rate abuse | Sign-in, guest search, booking, messaging | Tiered rate limits, idempotent retries and monitoring; load/abuse tests. |
| Background-job privilege leakage | Queued tasks and workers | Persist minimum actor/tenant/venue context, recheck authority at execution and enforce scoped worker identity. |

## Verification by change category

| Change | Required gates |
|---|---|
| Foundation/auth/tenant | Unit, database, API contract, authorization and cross-tenant/venue negative tests, security review and regression. |
| Domain behavior | Unit, database/integration, API contract and affected E2E/regression paths. |
| Permissions or role mapping | Matrix tests for allowed/denied paths, object authorization, audit and alternate-role E2E. |
| Schema/migration | Up/down or forward-fix plan, data backfill, tenancy, rollback/restore rehearsal and affected contract tests. |
| Imports/webhooks/payments | Idempotency, replay, invalid payload, isolation, audit, retry and failure-path tests using isolated fixtures. |

No application code, identity provider connection, migration, or production security setting is changed by this document.
