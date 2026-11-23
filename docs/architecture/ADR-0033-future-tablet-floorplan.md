# ADR-0033 — Future tablet compatibility for Floorplan and Reservation Book

## Decision

The owner approved these compatibility constraints on 2026-11-23. They apply
to existing Floorplan and Reservation Book changes within their authorized
scope. FLOORPLAN-CORE-01-TABLET defines the deferred delivery and verification
gates.

- Reuse the React/TypeScript frontend, Fastify backend and PostgreSQL database.
  Keep one authoritative source for reservation, table and area data. Reuse
  the existing booking and allocation rules through the shared backend.
- Keep positions independent of physical screen dimensions. Preserve normalized
  coordinates through resizing, rotation and zoom. Use responsive layouts and
  touch-friendly controls with accessible alternatives to drag interactions.
- Keep manager layout and area editing separate from Host seating and movement
  permissions and Server operational reads. Reuse trusted staff authorization,
  explicit Venue access, RLS, scoped data visibility, write assurance and
  reservation-integrity guarantees.
- Preserve versioned state, stale-write detection and atomic allocation so
  future desktop and tablet sessions can synchronize through the same service.
  Real-time infrastructure, offline synchronization, native tablet apps and
  expanded grants require separate owner authorization. This decision does not
  authorize any of them or a tablet-specific backend or test cycle.

## Existing boundaries

Reuse SCR-005 and the staff Reservation Book (SCR-002, SCR-003 and SCR-139)
under FLOORPLAN-CORE-01 and RESERVATIONS-CORE-01. Existing local architecture
uses normalized layout coordinates, independent versioned seating areas and a
read-only Reservation Book area projection. Operational seating and movement
remain subject to the existing reservation allocation and state transitions.

The pinned POS 2026 v0.1 registry maps ProjectX PROV-TABLE and PROV-FLOORPLAN
to the FLOOR review group. PX-BOOKING and the RESERVATION group identify the
existing reservation boundary. The consulted ProjectX baseline is
f7f07f9c74ee645f2abbde9fa8926f2f566ab524 with separate local evidence in the
project map. ProjectX retains its standalone projection and reservation logic.
Integrated table catalog authority remains provisional and subject to approval.
Reuse these surfaces and boundaries for future verification. If this decision
is superseded before implementation, amend this ADR and its roadmap reference.
