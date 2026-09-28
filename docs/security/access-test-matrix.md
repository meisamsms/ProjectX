# Future access test matrix — FOUND-TASK-002

All expected results are **INFERRED ProjectX contract** from ADR-0003/0004; they are not observed outcomes of the reference application. Use isolated accounts, two Organizations, two Venues per Organization, two Clients with matching-shaped identifiers and disposable reservations. No production action was executed. `DENY` below means no protected data or side effect; audit requirements are future behavior, not existing tests.

| Scenario | Expected | HTTP class | Audit expectation | Future check |
|---|---|---|---|---|
| Active member, explicit Venue Access, correct scoped permission and matching reservation | ALLOW | 2xx | Sensitive writes audited | Positive read/write with isolated fixture |
| Member of correct Organization but no access to selected Venue | DENY | 403 for context switch; 404 for object | Denied sensitive attempt | Swap venue ID and object ID |
| Same Organization, wrong Venue with valid reservation ID | DENY | 404 | Denied object access | Two Venue fixtures |
| Different Organization with guessed valid object ID | DENY | 404 | Denied cross-tenant attempt | Two Organization fixtures; compare response |
| Correct Venue but missing permission | DENY | 403 | Failed privileged access audited | Remove one grant |
| Role renamed but permission unchanged | ALLOW | 2xx | Role edit audited | Rename template and retry |
| Role/grant removed mid-session | DENY | 403 | Change and denied attempt audited | Revoke grant; reuse old session |
| Organization Membership revoked mid-session | DENY | 403 | Revoke and denied attempt audited | Retry old session and selection |
| Venue Access revoked independently | DENY | 403 for switch; 404 for object | Revoke and denied attempt audited | Old session attempts old Venue |
| User disabled | DENY | 403; subsequent session revoked/401 | Disable and attempt audited | Disable user during active session |
| Expired or revoked session | DENY | 401 | Logout/revocation where useful | Retry expired cookie |
| Organization Admin with explicit cross-Venue client history permission | ALLOW | 2xx | Cross-Venue read audited | Query authorized history under same Organization |
| Organization Admin lacking Venue Access tries venue reservation | DENY | 403 context / 404 object | Denied attempt | Confirm admin title does not bypass grant |
| Venue user tries organization settings or cross-Venue client notes | DENY | 403 settings / 404 notes | Privileged denial audited | Attempt both with valid IDs |
| Venue user searches organization-level Clients without explicit grant | DENY | 403 | Denied search audited | Search using cross-Venue identity |
| Venue user reads own Venue's permitted Client identity and profile | ALLOW | 2xx | Sensitive read audit policy to define | Field-minimization check |
| User edits own roles or grants | DENY | 403 | Self-escalation attempt audited | Attempt user.manage mutation |
| Changed Organization context retains old Venue ID | DENY | 403 | Context switch audited | Switch organization then reuse old venue |
| Privileged mutation without required step-up | DENY | 403 | Step-up failure audited | Expire assurance and retry |
| RLS query under missing/incorrect transaction context | DENY | No rows / rejected transaction | Database security failure telemetry | Connection-pool reuse and cross-tenant negative tests in FOUND-TASK-003 |

For every denied object case, compare missing-object and foreign-object response bodies and timing within reasonable limits so tenant existence is not disclosed. Test result is **NEEDS TESTING** until implementation tasks create isolated harnesses. Exact response mapping may be refined in OpenAPI contracts while preserving deny behavior and anti-enumeration guarantees.
