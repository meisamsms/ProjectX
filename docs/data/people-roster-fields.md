# PEOPLE-03P roster field persistence

Status: local implementation pending PostgreSQL 16 CI. This is an approved **ProjectX implementation decision**, not a claim about SevenRooms storage or validation.

| Owner | Field | Type | `NULL` meaning |
|---|---|---|---|
| User | `first_name` | nullable text | Not yet supplied / unknown |
| User | `last_name` | nullable text | Not yet supplied / unknown |
| OrganizationMembership | `job_title` | nullable text | No job title stored |
| OrganizationMembership | `email_notifications_enabled` | nullable boolean | Preference not established |

An explicit `false` means notifications disabled; an explicit `true` means enabled. Do not coalesce `NULL` to `false`. The later PEOPLE-03 read API may derive `name` from supplied name parts and return `name: null` when both are absent; that API contract is not implemented here. No validation or mutation behavior of the reference product is inferred. The migration has no defaults or backfill, so existing records retain unknown/unconfigured values.

The forward migration only adds columns to two previously RLS-protected tables. It does not add write privileges or policies to the restricted runtime role. Synthetic tests cover clean/PEOPLE-02 upgrade, old checksums and rows, tri-state values, organization-specific membership values, cross-organization RLS visibility and denied runtime writes. No Add User, notifications delivery, UI, OIDC, session or read endpoint is part of this prerequisite. U-002, U-003 and FLOW-006 remain unresolved; Export behavior remains unknown.
