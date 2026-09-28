# Candidate data boundaries — ARCH-001

These 46 names came from the discovery map's likely-entity index. They are **candidate concepts**, not database tables or a reconstruction of SevenRooms' schema. Grouping and aggregate ownership below are INFERRED. No migration or persistence technology is selected.

| Category (INFERRED) | Candidate entities | Ownership and boundary questions |
|---|---|---|
| Identity and access | User, Role, Permission, Staff, Concierge | Account identity versus venue membership and staff association UNKNOWN; confirm cross-venue grants. |
| Venue/configuration | Venue, Tax Rate, Reservation Policy, Operating Hours, Mode | Venue-owned configuration likely; organization/account ownership and inheritance UNKNOWN. |
| Clients and preferences | Client, Client Tag, Tag, Consent | PII and marketing consent; client sharing across venues UNKNOWN. |
| Reservation and financial context | Reservation, Request, Payment, Charge | Reservation links guest, shift, table and area; payment custody/provider responsibility UNKNOWN. |
| Availability | Shift, Access Rule, Pacing | Date/shift/rule/area interplay visible; exact slot formula and write conflict guards NEEDS TESTING. |
| Floorplan | Room, Seating Area, Table, Floorplan Layout | Layout/table membership and activation enforcement NEEDS TESTING. |
| Communications and voice | Notification, Email Campaign, Email Settings, Call, Recording, Voice Agent, Voice Instruction, FAQ | Delivery, consent and recording retention UNKNOWN; independent provider boundaries likely. |
| Marketing, feedback and sales | Auto Tag, Boost Campaign, Feedback, Review, Review Source, Offer, Upgrade, Upgrade Category, Experience, Media, Perk | Optional packages and publish/payment outcomes UNKNOWN. |
| Reporting/read models | Report, Spend | Detailed metrics and export/delivery semantics deferred by product owner. |

All 46 are classified once. An Audit Event is a **proposed new implementation concept**, not a discovered candidate entity. Do not invent it as a confirmed reference record.

## Ownership and aggregate hypotheses

- INFERRED: A venue owns shifts, rules, layouts, tables, seating areas and policies; account/organization sharing must be decided in ARCH-D004/D006/D007.
- INFERRED: A reservation is a transactional boundary for guest reference, date/time, shift, party size, status, assigned table/area and payment-related references. Status options are visible; allowed transitions and writes NEEDS TESTING.
- INFERRED: Client identity/profile/consent needs a separate ownership boundary so deduplication and removal can be controlled. Group/global client search wording is observed; sharing rules UNKNOWN.
- INFERRED: Layout and table configuration is distinct from a live seating assignment; whether edits become active immediately is UNKNOWN.
- INFERRED: Requests may convert to reservations, but the conversion effect is UNKNOWN; avoid hard database coupling before isolated verification.

## Transactional and contention boundaries

- Booking candidate: availability check, table assignment, reservation create, audit event and idempotency result must be consistent or explicitly compensated. High contention is plausible for the same table/time/shift; measure with isolated concurrent fixtures.
- Shift/access-rule/layout changes can affect future bookability; use version/concurrency controls and audit. Current production write behavior is UNKNOWN.
- Payment/charge execution must be idempotent and reconciled with reservation state, but no payment execution was observed; never use live data to infer a payment state machine.
- Imports need staged parsing, tenant scoping, duplicates and all-or-nothing or explicit partial-row semantics; UI states rows missing required fields are skipped, actual commit is untested.

## PII, audit and lifecycle

- Client contact, notes, occasions, consent and possible call recordings are PII. Restrict access by role and venue, redact logs and exports, and require owner retention/deletion decisions.
- Reservation changes, status transitions, assignments, permission grants, payment-adjacent events, imports and configuration changes require immutable audit metadata (proposal). Activity history is visible on the reference UI, storage details UNKNOWN.
- Potential soft deletion, anonymization and retention needs: client profile removal, user suspension, reservation cancellation, audit retention, imports, media and recordings. Exact legal/operational retention policy remains UNKNOWN.
- Data boundaries must not depend solely on IDs embedded in URLs. Verify actor membership and object scope before access.

No final fields, keys, tables or migration plan is approved by this document.
