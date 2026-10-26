# ADR-0021 — Authenticated Staff Reservation HTTP API (`RESERVATION-DOMAIN-004`)

Status: ACCEPTED (ProjectX implementation decision, verified by CHK-085). Owner
explicitly authorized the bounded nonproduction P1 implementation of the
authenticated Staff Reservation HTTP API (`RESERVATION-DOMAIN-004`) reusing the
verified internal reservation domain (`RESERVATION-DOMAIN-001/002/003`),
`PEOPLE-CORE-01`, `DB-HARNESS-001`, and the implemented local `CORE-AUTH-02`
staff session middleware. This is a ProjectX implementation contract, not
inferred reference-application behavior.

## Route namespace and boundary

All staff reservation HTTP endpoints are mounted under `/api/v1/staff/reservations`
in `apps/api/src/reservations/route.ts` and wired in `apps/api/src/app.ts`
(`registerReservations(app, venue ?? options?.reservations)`):

| Method & Path | Operation ID | Service Function | Required Venue Permissions |
| --- | --- | --- | --- |
| `GET /api/v1/staff/reservations/availability` | `searchStaffReservationAvailability` | `searchAvailability` | `reservation.read` |
| `GET /api/v1/staff/reservations` | `listStaffReservations` | `listReservations` | `reservation.read` |
| `POST /api/v1/staff/reservations` | `createStaffReservation` | `createReservation` | `reservation.read` + `reservation.create` |
| `GET /api/v1/staff/reservations/{id}` | `getStaffReservation` | `getReservation` | `reservation.read` |
| `PATCH /api/v1/staff/reservations/{id}` | `modifyStaffReservation` | `modifyReservation` | `reservation.read` + `reservation.update` |
| `POST /api/v1/staff/reservations/{id}/check-in` | `checkInStaffReservation` | `checkInReservation` | `reservation.read` + `reservation.checkin` |
| `POST /api/v1/staff/reservations/{id}/seat` | `seatStaffReservation` | `seatReservation` | `reservation.read` + `reservation.seat` |
| `POST /api/v1/staff/reservations/{id}/cancel` | `cancelStaffReservation` | `cancelReservation` | `reservation.read` + `reservation.cancel` |

Unscoped/public `/api/v1/reservations` remains unmounted (`404 NOT_FOUND`). No
public guest widget routes, browser authentication bypasses, or database
schema changes are introduced.

## Security and error mapping

1. **Staff session and Venue context**: `apps/api/src/staff-auth/routes.ts`
   protects `/api/v1/staff/reservations` and `/api/v1/staff/reservations/*`.
   Every request sets `Cache-Control: no-store` and `Referrer-Policy: no-referrer`,
   validates canonical `Host` (rejecting `X-Forwarded-Host` with `403`), requires
   a valid `__Host-projectx-session` cookie (`401` if missing/expired/revoked,
   `403` if the user is disabled), and requires both `session.organizationId` and
   `session.venueId` (`403` when `venueId` is null).
2. **CSRF, Origin/Referer, and Context Version**: Every `POST`/`PUT`/`PATCH`/`DELETE`
   request requires a valid same-origin `Origin` (or `Referer` when `Origin` is
   absent), session-bound `X-ProjectX-CSRF` header (`403` on mismatch), and
   `X-ProjectX-Context-Version` matching `session.contextVersion` (`409 CONFLICT`
   when stale). Only successful mutations (`statusCode < 400`) extend idle
   session activity.
3. **Strict input validation and tenant authority**: Route `preValidation` hooks
   reject unknown or duplicate query parameters, non-UUID path IDs, type coercion,
   and any caller-supplied `organizationId`, `venueId`, `userId`, `role`, or
   `permissions` fields with `400 INVALID_REQUEST` before domain execution.
4. **Deterministic error mapping and redaction**:
   - `INVALID_INPUT` -> `400` (`INVALID_REQUEST`)
   - `ACCESS_DENIED` / `PeopleAccessDenied` / `42501` -> `403` (`FORBIDDEN`)
   - `NOT_FOUND` -> `404` (`NOT_FOUND`)
   - `CAPACITY_CONFLICT` -> `409` (`CAPACITY_CONFLICT`)
   - `IDEMPOTENCY_CONFLICT` -> `409` (`IDEMPOTENCY_CONFLICT`)
   - `VERSION_CONFLICT` -> `409` (`VERSION_CONFLICT`)
   - `INVALID_STATE` -> `409` (`INVALID_STATE`)
   - `INTERNAL` or unexpected error -> `500` (`INTERNAL_ERROR`) with SQL, stack
     traces, credentials, and guest PII redacted from responses and logs.
