# ADR-0022 — Staff Reservation Book Browser UI (`RESERVATION-DOMAIN-005`)

Status: ACCEPTED (ProjectX implementation decision, verified by CHK-086). Owner
explicitly authorized the bounded nonproduction P1 implementation of the Staff
Reservation Book UI (`RESERVATION-DOMAIN-005`) covering `SCR-002` (`Reservations day`),
`SCR-003` (`Add Reservation slideout`), and `SCR-139` (`Existing reservation detail panel`)
on top of the verified authenticated Staff Reservation HTTP API
(`RESERVATION-DOMAIN-004`, `ADR-0021`) and internal reservation domain
(`RESERVATION-DOMAIN-001/002/003`, `ADR-0018/0019/0020`). This is a ProjectX
implementation contract, not inferred reference-application behavior.

## Route and surface integration

`apps/web/src/shell.tsx` wires `SCR-002` (`/manager/oceansatarthurs/reservations/day/:date`)
to render `<ReservationsBookPage />` (`apps/web/src/reservations/page.tsx`) backed by
the typed HTTP client in `apps/web/src/reservations/client.ts`:

- **SCR-002 (`Reservations day`)**: Initializes from the route's `:date` parameter
  when valid (`YYYY-MM-DD`, `2000-01-01`..`2099-12-31`, defaulting to a valid
  service date when navigated via literal `:date`), loads the authorized Venue's
  reservations (`listStaffReservations`) and available slots
  (`searchStaffReservationAvailability`), and supports availability filtering by
  date, party size (`1..50`), and optional minute window (`fromMinute`, `toMinute`).
- **SCR-003 (`Add Reservation`)**: Selecting an available slot opens the
  accessible Add Reservation surface pre-bound to that slot (`tableId`, `shiftId`,
  `startsAt`, `date`, `partySize`), validates guest name (`1..120` Unicode code
  points, no control characters or lone surrogates) and email syntax locally,
  maintains a draft-bound UUID `idempotencyKey`, and submits `createStaffReservation`.
- **SCR-139 (`Existing reservation detail panel`)**: Selecting a reservation
  displays its booking status (`BOOKED`, `CHECKED_IN`, `SEATED`, `CANCELLED`),
  revision, guest details, and table/shift/time allocation. For `BOOKED`
  reservations, staff can modify date, party size, start time, table, and shift
  (`modifyStaffReservation` with `expectedRevision` and UUID `idempotencyKey`),
  check in (`checkInStaffReservation`), or cancel (`cancelStaffReservation`). For
  `CHECKED_IN` reservations, staff can seat (`seatStaffReservation` with
  `expectedRevision` and UUID `idempotencyKey`). `SEATED` and `CANCELLED`
  reservations disable further modification or lifecycle transitions.

## Security, draft preservation, and accessibility

1. **No URL-derived authorization**: The URL's Venue slug (`oceansatarthurs`) is
   never trusted or sent as authorization authority. All requests use `staffFetch`
   (`apps/web/src/staff-auth/client.ts`) with same-origin credentials,
   `X-ProjectX-CSRF`, and `X-ProjectX-Context-Version`, relying strictly on
   server-derived Organization and Venue scope.
2. **Safe error redaction and draft preservation**: `ReservationRequestError`
   extracts only HTTP `status` and structured error `code` (`CAPACITY_CONFLICT`,
   `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `INVALID_STATE`), never rendering
   raw server error messages, SQL details, or stack traces. On `400`, `401`, `403`,
   `404`, `409`, or `500` mutation failures, unsaved create/modify drafts remain
   intact, `404`/`409 VERSION_CONFLICT` blocks stale saves until refreshed, and
   refreshing a dirty draft requires explicit confirmation (`Keep editing` vs
   `Discard changes and refresh`).
3. **Keyboard and screen-reader accessibility**: Forms and controls use explicit
   `<label>` associations, `aria-invalid`/`aria-describedby` validation states,
   and programmatic focus on `role="alert"` / `role="status"` announcements,
   verified with `@axe-core/playwright` zero accessibility violations.
