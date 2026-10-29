import { useEffect, useRef, useState } from "react";
import { matchPath, useLocation } from "react-router-dom";
import {
  cancelStaffReservation,
  checkInStaffReservation,
  createStaffReservation,
  getStaffReservation,
  listStaffReservations,
  modifyStaffReservation,
  ReservationRequestError,
  seatStaffReservation,
  searchStaffReservationAvailability,
  type StaffReservation,
  type StaffReservationSlot,
} from "./client";

export const DEFAULT_RESERVATION_DATE = "2028-01-15";

const DATE_PATTERN = /^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_ISO_PATTERN =
  /^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,3})?Z$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasControlOrLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0xd800 && code <= 0xdfff && !value.codePointAt(index))
    ) {
      return true;
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export function isValidLocalDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function guestNameValidation(value: string): string | null {
  if (value.length > 1024) {
    return "Guest name must be 120 characters or fewer.";
  }
  if (hasControlOrLoneSurrogate(value)) {
    return "Guest name cannot include control characters or invalid text.";
  }
  const length = [...value.trim()].length;
  if (length === 0) return "Enter a guest name.";
  if (length > 120) return "Guest name must be 120 characters or fewer.";
  return null;
}

export function guestEmailValidation(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Enter a guest email address.";
  if (trimmed.length < 3 || trimmed.length > 254) {
    return "Guest email must be between 3 and 254 characters.";
  }
  if (hasControlOrLoneSurrogate(trimmed) || !EMAIL_PATTERN.test(trimmed)) {
    return "Enter a valid guest email address.";
  }
  return null;
}

export function searchCriteriaValidation(criteria: {
  date: string;
  partySize: string;
  fromMinute: string;
  toMinute: string;
}): string | null {
  if (!isValidLocalDate(criteria.date.trim())) {
    return "Enter a valid date in YYYY-MM-DD format.";
  }
  const party = Number(criteria.partySize);
  if (!Number.isInteger(party) || party < 1 || party > 50) {
    return "Party size must be a whole number between 1 and 50.";
  }
  const fromTrimmed = criteria.fromMinute.trim();
  const toTrimmed = criteria.toMinute.trim();
  const fromValue = fromTrimmed === "" ? undefined : Number(fromTrimmed);
  const toValue = toTrimmed === "" ? undefined : Number(toTrimmed);
  if (
    fromValue !== undefined &&
    (!Number.isInteger(fromValue) || fromValue < 0 || fromValue > 1439)
  ) {
    return "From minute must be an integer between 0 and 1439.";
  }
  if (
    toValue !== undefined &&
    (!Number.isInteger(toValue) || toValue < 1 || toValue > 1440)
  ) {
    return "To minute must be an integer between 1 and 1440.";
  }
  if (
    fromValue !== undefined &&
    toValue !== undefined &&
    fromValue >= toValue
  ) {
    return "From minute must be less than To minute.";
  }
  return null;
}

export function modifyDraftValidation(draft: {
  date: string;
  partySize: string;
  startsAt: string;
  tableId: string;
  shiftId: string;
}): string | null {
  if (!isValidLocalDate(draft.date.trim())) {
    return "Modify date must be a valid YYYY-MM-DD date.";
  }
  const party = Number(draft.partySize);
  if (!Number.isInteger(party) || party < 1 || party > 50) {
    return "Modify party size must be a whole number between 1 and 50.";
  }
  if (!UTC_ISO_PATTERN.test(draft.startsAt.trim())) {
    return "Modify starts at must be a UTC ISO-8601 timestamp ending in Z.";
  }
  if (!UUID_PATTERN.test(draft.tableId.trim())) {
    return "Modify table ID must be a valid UUID.";
  }
  if (!UUID_PATTERN.test(draft.shiftId.trim())) {
    return "Modify shift ID must be a valid UUID.";
  }
  return null;
}

export function safeReservationError(error: unknown): string {
  if (error instanceof ReservationRequestError) {
    if (error.status === 400) {
      return "The reservation request could not be accepted. Check the form fields and try again.";
    }
    if (error.status === 401) {
      return "Your session is no longer active. Sign in again to continue.";
    }
    if (error.status === 403) {
      return "You do not have access to perform this reservation action for the current venue.";
    }
    if (error.status === 404) {
      return "This reservation or venue resource is no longer available. Your draft is retained; refresh to continue.";
    }
    if (error.status === 409) {
      if (error.code === "CAPACITY_CONFLICT") {
        return "The selected table or time slot is no longer available (capacity conflict). Your draft is retained; choose another slot or refresh availability.";
      }
      if (error.code === "VERSION_CONFLICT") {
        return "This reservation was updated by another staff member (stale revision). Your draft is retained; refresh the reservation before saving.";
      }
      if (error.code === "IDEMPOTENCY_CONFLICT") {
        return "This request conflicted with an earlier submission key. Your draft is retained; adjust or refresh before retrying.";
      }
      if (error.code === "INVALID_STATE") {
        return "This reservation is no longer in a valid status for that action. Your draft is retained; refresh the reservation to view its current status.";
      }
      return "This reservation or session context changed before your request completed. Your draft is retained; refresh before retrying.";
    }
    return "The reservation book could not be loaded or updated right now. Your draft is retained; try again.";
  }
  return "The reservation book could not be loaded or updated right now. Your draft is retained; try again.";
}

interface CreateDraft {
  slot: StaffReservationSlot;
  date: string;
  partySize: number;
  guestName: string;
  guestEmail: string;
  idempotencyKey: string;
}

interface ModifyDraft {
  reservationId: string;
  expectedRevision: number;
  date: string;
  partySize: string;
  startsAt: string;
  tableId: string;
  shiftId: string;
  idempotencyKey: string;
  blocked: boolean;
}

function nextUuid(): string {
  return crypto.randomUUID();
}

function createModifyDraft(reservation: StaffReservation): ModifyDraft {
  return {
    reservationId: reservation.id,
    expectedRevision: reservation.revision,
    date: reservation.date,
    partySize: String(reservation.partySize),
    startsAt: reservation.startsAt,
    tableId: reservation.tableId,
    shiftId: reservation.shiftId,
    idempotencyKey: nextUuid(),
    blocked: false,
  };
}

function isModifyDraftDirty(
  draft: ModifyDraft | null,
  reservation: StaffReservation | null,
): boolean {
  if (!draft || !reservation || draft.reservationId !== reservation.id) {
    return false;
  }
  return (
    draft.expectedRevision !== reservation.revision ||
    draft.date.trim() !== reservation.date ||
    draft.partySize.trim() !== String(reservation.partySize) ||
    draft.startsAt.trim() !== reservation.startsAt ||
    draft.tableId.trim() !== reservation.tableId ||
    draft.shiftId.trim() !== reservation.shiftId
  );
}

export interface ReservationsBookPageProps {
  initialDate?: string;
  searchAvailability?: typeof searchStaffReservationAvailability;
  listReservations?: typeof listStaffReservations;
  getReservation?: typeof getStaffReservation;
  createReservation?: typeof createStaffReservation;
  modifyReservation?: typeof modifyStaffReservation;
  checkInReservation?: typeof checkInStaffReservation;
  seatReservation?: typeof seatStaffReservation;
  cancelReservation?: typeof cancelStaffReservation;
}

export function ReservationsBookPage({
  initialDate,
  searchAvailability = searchStaffReservationAvailability,
  listReservations = listStaffReservations,
  getReservation = getStaffReservation,
  createReservation = createStaffReservation,
  modifyReservation = modifyStaffReservation,
  checkInReservation = checkInStaffReservation,
  seatReservation = seatStaffReservation,
  cancelReservation = cancelStaffReservation,
}: ReservationsBookPageProps) {
  const location = useLocation();
  const routeMatch = matchPath(
    { path: "/manager/:venueSlug/reservations/day/:date", end: true },
    location.pathname,
  );
  const routeDate = routeMatch?.params.date;
  const resolvedInitialDate =
    initialDate && isValidLocalDate(initialDate)
      ? initialDate
      : routeDate && isValidLocalDate(routeDate)
        ? routeDate
        : DEFAULT_RESERVATION_DATE;

  const [searchForm, setSearchForm] = useState({
    date: resolvedInitialDate,
    partySize: "2",
    fromMinute: "",
    toMinute: "",
  });
  const [appliedSearch, setAppliedSearch] = useState({
    date: resolvedInitialDate,
    partySize: 2,
    fromMinute: undefined as number | undefined,
    toMinute: undefined as number | undefined,
  });

  const [slots, setSlots] = useState<StaffReservationSlot[]>([]);
  const [reservations, setReservations] = useState<StaffReservation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>("Loading reservation book…");
  const [error, setError] = useState<{ message: string } | null>(null);
  const [success, setSuccess] = useState<{ message: string } | null>(null);

  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modifyDraft, setModifyDraft] = useState<ModifyDraft | null>(null);
  const [transitionKeys, setTransitionKeys] = useState<{
    checkIn: string;
    seat: string;
  }>(() => ({
    checkIn: nextUuid(),
    seat: nextUuid(),
  }));
  const [confirmRefresh, setConfirmRefresh] = useState<
    "book" | "detail" | null
  >(null);

  const lock = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const createGuestNameRef = useRef<HTMLInputElement>(null);
  const refreshBookRef = useRef<HTMLButtonElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);

  const selectedReservation =
    reservations.find((item) => item.id === selectedId) ?? null;
  const modifyStale = Boolean(
    modifyDraft &&
      selectedReservation &&
      modifyDraft.reservationId === selectedReservation.id &&
      modifyDraft.expectedRevision !== selectedReservation.revision,
  );

  const dirty =
    createDraft !== null ||
    isModifyDraftDirty(modifyDraft, selectedReservation);

  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    lock.current = true;
    setBusy("Loading reservation book…");
    Promise.all([
      listReservations(
        { date: resolvedInitialDate, limit: 100 },
        request.signal,
      ),
      searchAvailability(
        { date: resolvedInitialDate, partySize: 2 },
        request.signal,
      ),
    ])
      .then(([listResult, availabilityResult]) => {
        if (request.signal.aborted) return;
        setReservations(listResult.items);
        setSlots(availabilityResult.items);
        setLoaded(true);
      })
      .catch((reason: unknown) => {
        if (!request.signal.aborted) {
          setError({ message: safeReservationError(reason) });
        }
      })
      .finally(() => {
        if (!request.signal.aborted) {
          lock.current = false;
          setBusy(null);
        }
      });
    return () => {
      request.abort();
      controller.current?.abort();
    };
  }, [listReservations, resolvedInitialDate, searchAvailability]);

  useEffect(() => {
    if (error || modifyStale) alertRef.current?.focus();
  }, [error, modifyStale]);

  useEffect(() => {
    if (success && !modifyStale) successRef.current?.focus();
  }, [success, modifyStale]);

  const createPanelOpen = createDraft !== null;
  useEffect(() => {
    if (createPanelOpen) {
      createGuestNameRef.current?.focus();
    }
  }, [createPanelOpen]);

  useEffect(() => {
    if (confirmRefresh !== null) {
      keepEditingRef.current?.focus();
    }
  }, [confirmRefresh]);

  async function perform<T>(
    label: string,
    action: (signal: AbortSignal) => Promise<T>,
    done: (value: T) => void,
    onFailure?: (reason: unknown) => void,
  ) {
    if (lock.current) return;
    lock.current = true;
    const request = new AbortController();
    controller.current = request;
    setBusy(label);
    setError(null);
    setSuccess(null);
    try {
      const value = await action(request.signal);
      if (!request.signal.aborted) {
        done(value);
      }
    } catch (reason: unknown) {
      if (!request.signal.aborted) {
        onFailure?.(reason);
        setError({ message: safeReservationError(reason) });
      }
    } finally {
      if (!request.signal.aborted) {
        lock.current = false;
        setBusy(null);
      }
    }
  }

  function buildAvailabilityQuery(criteria = appliedSearch) {
    return {
      date: criteria.date,
      partySize: criteria.partySize,
      ...(criteria.fromMinute !== undefined
        ? { fromMinute: criteria.fromMinute }
        : {}),
      ...(criteria.toMinute !== undefined
        ? { toMinute: criteria.toMinute }
        : {}),
    };
  }

  function executeBookRefresh(criteria = appliedSearch, discardDrafts = false) {
    setConfirmRefresh(null);
    void perform(
      "Refreshing reservation book…",
      (signal) =>
        Promise.all([
          listReservations({ date: criteria.date, limit: 100 }, signal),
          searchAvailability(buildAvailabilityQuery(criteria), signal),
        ]),
      ([listResult, availabilityResult]) => {
        setReservations(listResult.items);
        setSlots(availabilityResult.items);
        setLoaded(true);
        if (discardDrafts) {
          setCreateDraft(null);
          const refreshedSelected =
            listResult.items.find((item) => item.id === selectedId) ?? null;
          setModifyDraft(
            refreshedSelected ? createModifyDraft(refreshedSelected) : null,
          );
        }
        // Search updates the list, never the open draft's version or retry key.
        setTransitionKeys({ checkIn: nextUuid(), seat: nextUuid() });
        setSuccess({ message: "Reservation book refreshed." });
      },
    );
  }

  function executeDetailRefresh(reservationId: string) {
    setConfirmRefresh(null);
    void perform(
      "Refreshing reservation detail…",
      (signal) => getReservation(reservationId, signal),
      (record) => {
        setReservations((current) =>
          current.some((item) => item.id === record.id)
            ? current.map((item) => (item.id === record.id ? record : item))
            : [...current, record],
        );
        setModifyDraft(createModifyDraft(record));
        setTransitionKeys({ checkIn: nextUuid(), seat: nextUuid() });
        setSuccess({ message: "Reservation detail refreshed." });
      },
    );
  }

  const searchError = searchCriteriaValidation(searchForm);
  const createNameError = createDraft
    ? guestNameValidation(createDraft.guestName)
    : null;
  const createEmailError = createDraft
    ? guestEmailValidation(createDraft.guestEmail)
    : null;
  const modifyValidationError = modifyDraft
    ? modifyDraftValidation(modifyDraft)
    : null;
  const modifyDirty = isModifyDraftDirty(modifyDraft, selectedReservation);

  return (
    <section
      className="accounts-page booked-by-page add-user-page"
      aria-labelledby="reservations-book-title"
    >
      <h1 id="reservations-book-title">Reservations Day Book</h1>
      <p>
        Manage venue reservations, availability search, booking, modification,
        check-in, seating, and cancellation for the current authorized venue.
      </p>
      {dirty && <p>Unsaved reservation changes</p>}
      {busy && <p role="status">{busy}</p>}
      {(error || modifyStale) && (
        <div
          role="alert"
          id="reservations-book-error"
          tabIndex={-1}
          ref={alertRef}
        >
          {modifyStale
            ? "This reservation changed elsewhere. Your draft is retained. Refresh reservation detail and review the latest values before saving."
            : error?.message}
        </div>
      )}
      {success && (
        <p role="status" tabIndex={-1} ref={successRef}>
          {success.message}
        </p>
      )}

      <div className="booked-actions">
        <button
          type="button"
          ref={refreshBookRef}
          disabled={busy !== null || confirmRefresh !== null}
          onClick={() =>
            dirty ? setConfirmRefresh("book") : executeBookRefresh()
          }
        >
          Refresh reservation book
        </button>
      </div>

      {confirmRefresh !== null && (
        <fieldset aria-label="Discard unsaved reservation changes and refresh?">
          <legend>Discard unsaved reservation changes and refresh?</legend>
          <p>
            Refreshing will discard your unsaved reservation draft after the
            latest data loads.
          </p>
          <button
            type="button"
            ref={keepEditingRef}
            onClick={() => setConfirmRefresh(null)}
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmRefresh === "detail" && selectedReservation) {
                executeDetailRefresh(selectedReservation.id);
              } else {
                executeBookRefresh(appliedSearch, true);
              }
            }}
          >
            Discard changes and refresh
          </button>
        </fieldset>
      )}

      {loaded && (
        <>
          <form
            aria-label="Search availability and reservations"
            onSubmit={(event) => {
              event.preventDefault();
              if (searchError) return;
              const nextCriteria = {
                date: searchForm.date.trim(),
                partySize: Number(searchForm.partySize),
                fromMinute:
                  searchForm.fromMinute.trim() === ""
                    ? undefined
                    : Number(searchForm.fromMinute.trim()),
                toMinute:
                  searchForm.toMinute.trim() === ""
                    ? undefined
                    : Number(searchForm.toMinute.trim()),
              };
              setAppliedSearch(nextCriteria);
              executeBookRefresh(nextCriteria, false);
            }}
          >
            <fieldset disabled={busy !== null || confirmRefresh !== null}>
              <legend>Search Availability (SCR-002)</legend>
              <div className="add-user-field">
                <label htmlFor="reservation-search-date">
                  Reservation date
                </label>
                <input
                  id="reservation-search-date"
                  value={searchForm.date}
                  onChange={(event) =>
                    setSearchForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                  aria-invalid={!isValidLocalDate(searchForm.date.trim())}
                />
              </div>
              <div className="add-user-field">
                <label htmlFor="reservation-search-party-size">
                  Party size
                </label>
                <input
                  id="reservation-search-party-size"
                  type="number"
                  min={1}
                  max={50}
                  value={searchForm.partySize}
                  onChange={(event) =>
                    setSearchForm((current) => ({
                      ...current,
                      partySize: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="add-user-field">
                <label htmlFor="reservation-search-from-minute">
                  From minute (0-1439, optional)
                </label>
                <input
                  id="reservation-search-from-minute"
                  type="number"
                  min={0}
                  max={1439}
                  value={searchForm.fromMinute}
                  onChange={(event) =>
                    setSearchForm((current) => ({
                      ...current,
                      fromMinute: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="add-user-field">
                <label htmlFor="reservation-search-to-minute">
                  To minute (1-1440, optional)
                </label>
                <input
                  id="reservation-search-to-minute"
                  type="number"
                  min={1}
                  max={1440}
                  value={searchForm.toMinute}
                  onChange={(event) =>
                    setSearchForm((current) => ({
                      ...current,
                      toMinute: event.target.value,
                    }))
                  }
                />
              </div>
              <p id="reservation-search-validation">
                {searchError ?? "Search criteria are valid."}
              </p>
              <button type="submit" disabled={searchError !== null}>
                Search availability
              </button>
            </fieldset>
          </form>

          <section aria-labelledby="available-slots-heading">
            <h2 id="available-slots-heading">
              Available Slots ({appliedSearch.date}, Party of{" "}
              {appliedSearch.partySize})
            </h2>
            {slots.length === 0 ? (
              <p>No available slots found for the selected criteria.</p>
            ) : (
              <ol aria-label="Available slots">
                {slots.map((slot, index) => (
                  <li key={`${slot.tableId}-${slot.startsAt}`}>
                    <p>
                      Slot {index + 1}: {slot.startsAt} to {slot.endsAt} (
                      {slot.timezone}) — Table {slot.tableId} / Shift{" "}
                      {slot.shiftId}
                    </p>
                    <button
                      type="button"
                      disabled={busy !== null || confirmRefresh !== null}
                      onClick={() => {
                        setError(null);
                        setSuccess(null);
                        setCreateDraft((current) => ({
                          slot,
                          date: appliedSearch.date,
                          partySize: appliedSearch.partySize,
                          guestName: current?.guestName ?? "",
                          guestEmail: current?.guestEmail ?? "",
                          idempotencyKey: nextUuid(),
                        }));
                      }}
                    >
                      Select slot {index + 1}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {createDraft !== null && (
            <section aria-labelledby="scr-003-title">
              <h2 id="scr-003-title">Add Reservation (SCR-003)</h2>
              <form
                aria-label="Add Reservation"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (createNameError || createEmailError) return;
                  const draftSnapshot = createDraft;
                  void perform(
                    "Creating reservation…",
                    async (signal) => {
                      const created = await createReservation(
                        {
                          date: draftSnapshot.date,
                          partySize: draftSnapshot.partySize,
                          tableId: draftSnapshot.slot.tableId,
                          shiftId: draftSnapshot.slot.shiftId,
                          startsAt: draftSnapshot.slot.startsAt,
                          guestName: draftSnapshot.guestName.trim(),
                          guestEmail: draftSnapshot.guestEmail.trim(),
                          idempotencyKey: draftSnapshot.idempotencyKey,
                        },
                        signal,
                      );
                      const refreshedAvailability = await searchAvailability(
                        buildAvailabilityQuery(),
                        signal,
                      ).catch(() => null);
                      return { created, refreshedAvailability };
                    },
                    ({ created, refreshedAvailability }) => {
                      setReservations((current) =>
                        current.some((item) => item.id === created.id)
                          ? current.map((item) =>
                              item.id === created.id ? created : item,
                            )
                          : [...current, created],
                      );
                      if (refreshedAvailability) {
                        setSlots(refreshedAvailability.items);
                      } else {
                        setSlots((current) =>
                          current.filter(
                            (slot) =>
                              !(
                                slot.tableId === created.tableId &&
                                slot.startsAt === created.startsAt
                              ),
                          ),
                        );
                      }
                      setCreateDraft(null);
                      setSelectedId(created.id);
                      setModifyDraft(createModifyDraft(created));
                      setSuccess({ message: "Reservation created." });
                    },
                  );
                }}
              >
                <fieldset disabled={busy !== null || confirmRefresh !== null}>
                  <legend>New reservation details</legend>
                  <p>
                    Selected slot: {createDraft.slot.startsAt} (Table{" "}
                    {createDraft.slot.tableId}, Shift {createDraft.slot.shiftId}
                    , Party of {createDraft.partySize} on {createDraft.date})
                  </p>
                  <div className="add-user-field">
                    <label htmlFor="create-guest-name">Guest name</label>
                    <input
                      id="create-guest-name"
                      ref={createGuestNameRef}
                      value={createDraft.guestName}
                      onChange={(event) =>
                        setCreateDraft((current) =>
                          current
                            ? {
                                ...current,
                                guestName: event.target.value,
                                idempotencyKey: nextUuid(),
                              }
                            : null,
                        )
                      }
                      aria-invalid={createNameError !== null}
                      aria-describedby="create-guest-name-validation"
                    />
                    <p id="create-guest-name-validation">
                      {createNameError ?? "Guest name is valid."}
                    </p>
                  </div>
                  <div className="add-user-field">
                    <label htmlFor="create-guest-email">Guest email</label>
                    <input
                      id="create-guest-email"
                      type="email"
                      value={createDraft.guestEmail}
                      onChange={(event) =>
                        setCreateDraft((current) =>
                          current
                            ? {
                                ...current,
                                guestEmail: event.target.value,
                                idempotencyKey: nextUuid(),
                              }
                            : null,
                        )
                      }
                      aria-invalid={createEmailError !== null}
                      aria-describedby="create-guest-email-validation"
                    />
                    <p id="create-guest-email-validation">
                      {createEmailError ?? "Guest email is valid."}
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={
                      createNameError !== null || createEmailError !== null
                    }
                  >
                    Create reservation
                  </button>
                  <button type="button" onClick={() => setCreateDraft(null)}>
                    Cancel add reservation
                  </button>
                </fieldset>
              </form>
            </section>
          )}

          <section aria-labelledby="reservations-list-heading">
            <h2 id="reservations-list-heading">
              Reservations for {appliedSearch.date}
            </h2>
            {reservations.length === 0 ? (
              <p>No reservations for this date.</p>
            ) : (
              <ol aria-label="Reservations for day">
                {reservations.map((item, index) => (
                  <li key={item.id}>
                    <p>
                      <strong>{item.guestName}</strong> ({item.guestEmail}) —
                      Status: <span>{item.status}</span> — Party of{" "}
                      {item.partySize} — {item.startsAt} — Table {item.tableId}{" "}
                      — Revision {item.revision}
                    </p>
                    <button
                      type="button"
                      disabled={busy !== null || confirmRefresh !== null}
                      onClick={() => {
                        setError(null);
                        setSuccess(null);
                        setSelectedId(item.id);
                        setModifyDraft((current) =>
                          current && current.reservationId === item.id
                            ? current
                            : createModifyDraft(item),
                        );
                        setTransitionKeys({
                          checkIn: nextUuid(),
                          seat: nextUuid(),
                        });
                      }}
                    >
                      View reservation {index + 1} ({item.guestName})
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {selectedReservation !== null && modifyDraft !== null && (
            <section aria-labelledby="scr-139-title">
              <h2 id="scr-139-title">Reservation Detail (SCR-139)</h2>
              <p>
                Guest: <strong>{selectedReservation.guestName}</strong> (
                {selectedReservation.guestEmail})
              </p>
              <p>
                Booking status: <strong>{selectedReservation.status}</strong> |
                Revision: {selectedReservation.revision} | Date:{" "}
                {selectedReservation.date} | Party size:{" "}
                {selectedReservation.partySize}
              </p>
              <p>
                Time: {selectedReservation.startsAt} to{" "}
                {selectedReservation.endsAt} ({selectedReservation.timezone}) |
                Table: {selectedReservation.tableId} | Shift:{" "}
                {selectedReservation.shiftId}
              </p>

              <div className="booked-actions">
                <button
                  type="button"
                  disabled={busy !== null || confirmRefresh !== null}
                  onClick={() =>
                    modifyDirty
                      ? setConfirmRefresh("detail")
                      : executeDetailRefresh(selectedReservation.id)
                  }
                >
                  Refresh reservation detail
                </button>
                <button
                  type="button"
                  disabled={busy !== null || confirmRefresh !== null}
                  onClick={() => {
                    setSelectedId(null);
                    setModifyDraft(null);
                  }}
                >
                  Close reservation detail
                </button>
              </div>

              {selectedReservation.status === "BOOKED" && (
                <div className="booked-actions">
                  <button
                    type="button"
                    disabled={busy !== null || confirmRefresh !== null}
                    onClick={() => {
                      const target = selectedReservation;
                      const key = transitionKeys.checkIn;
                      void perform(
                        "Checking in reservation…",
                        async (signal) => {
                          const updated = await checkInReservation(
                            target.id,
                            {
                              expectedRevision: target.revision,
                              idempotencyKey: key,
                            },
                            signal,
                          );
                          const refreshedAvailability =
                            await searchAvailability(
                              buildAvailabilityQuery(),
                              signal,
                            ).catch(() => null);
                          return { updated, refreshedAvailability };
                        },
                        ({ updated, refreshedAvailability }) => {
                          setReservations((current) =>
                            current.map((item) =>
                              item.id === updated.id ? updated : item,
                            ),
                          );
                          if (refreshedAvailability) {
                            setSlots(refreshedAvailability.items);
                          }
                          setModifyDraft(createModifyDraft(updated));
                          setTransitionKeys({
                            checkIn: nextUuid(),
                            seat: nextUuid(),
                          });
                          setSuccess({ message: "Reservation checked in." });
                        },
                      );
                    }}
                  >
                    Check in reservation
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null || confirmRefresh !== null}
                    onClick={() => {
                      const target = selectedReservation;
                      void perform(
                        "Cancelling reservation…",
                        async (signal) => {
                          const updated = await cancelReservation(
                            target.id,
                            signal,
                          );
                          const refreshedAvailability =
                            await searchAvailability(
                              buildAvailabilityQuery(),
                              signal,
                            ).catch(() => null);
                          return { updated, refreshedAvailability };
                        },
                        ({ updated, refreshedAvailability }) => {
                          setReservations((current) =>
                            current.map((item) =>
                              item.id === updated.id ? updated : item,
                            ),
                          );
                          if (refreshedAvailability) {
                            setSlots(refreshedAvailability.items);
                          }
                          setModifyDraft(createModifyDraft(updated));
                          setSuccess({ message: "Reservation cancelled." });
                        },
                      );
                    }}
                  >
                    Cancel reservation
                  </button>
                </div>
              )}

              {selectedReservation.status === "CHECKED_IN" && (
                <div className="booked-actions">
                  <button
                    type="button"
                    disabled={busy !== null || confirmRefresh !== null}
                    onClick={() => {
                      const target = selectedReservation;
                      const key = transitionKeys.seat;
                      void perform(
                        "Seating reservation…",
                        async (signal) => {
                          const updated = await seatReservation(
                            target.id,
                            {
                              expectedRevision: target.revision,
                              idempotencyKey: key,
                            },
                            signal,
                          );
                          const refreshedAvailability =
                            await searchAvailability(
                              buildAvailabilityQuery(),
                              signal,
                            ).catch(() => null);
                          return { updated, refreshedAvailability };
                        },
                        ({ updated, refreshedAvailability }) => {
                          setReservations((current) =>
                            current.map((item) =>
                              item.id === updated.id ? updated : item,
                            ),
                          );
                          if (refreshedAvailability) {
                            setSlots(refreshedAvailability.items);
                          }
                          setModifyDraft(createModifyDraft(updated));
                          setTransitionKeys({
                            checkIn: nextUuid(),
                            seat: nextUuid(),
                          });
                          setSuccess({ message: "Reservation seated." });
                        },
                      );
                    }}
                  >
                    Seat reservation
                  </button>
                </div>
              )}

              {selectedReservation.status === "BOOKED" ? (
                <form
                  aria-label="Modify reservation"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (
                      !modifyDirty ||
                      modifyStale ||
                      modifyValidationError !== null ||
                      modifyDraft.blocked
                    ) {
                      return;
                    }
                    const target = selectedReservation;
                    const draftSnapshot = modifyDraft;
                    void perform(
                      "Saving reservation changes…",
                      async (signal) => {
                        const updated = await modifyReservation(
                          target.id,
                          {
                            expectedRevision: draftSnapshot.expectedRevision,
                            idempotencyKey: draftSnapshot.idempotencyKey,
                            date: draftSnapshot.date.trim(),
                            partySize: Number(draftSnapshot.partySize),
                            startsAt: draftSnapshot.startsAt.trim(),
                            tableId: draftSnapshot.tableId.trim(),
                            shiftId: draftSnapshot.shiftId.trim(),
                          },
                          signal,
                        );
                        const refreshedAvailability = await searchAvailability(
                          buildAvailabilityQuery(),
                          signal,
                        ).catch(() => null);
                        return { updated, refreshedAvailability };
                      },
                      ({ updated, refreshedAvailability }) => {
                        setReservations((current) =>
                          current.map((item) =>
                            item.id === updated.id ? updated : item,
                          ),
                        );
                        if (refreshedAvailability) {
                          setSlots(refreshedAvailability.items);
                        }
                        setModifyDraft(createModifyDraft(updated));
                        setSuccess({ message: "Reservation modified." });
                      },
                      (reason) => {
                        if (
                          reason instanceof ReservationRequestError &&
                          (reason.status === 404 ||
                            (reason.status === 409 &&
                              reason.code === "VERSION_CONFLICT"))
                        ) {
                          setModifyDraft((current) =>
                            current ? { ...current, blocked: true } : null,
                          );
                        }
                      },
                    );
                  }}
                >
                  <fieldset disabled={busy !== null || confirmRefresh !== null}>
                    <legend>Modify reservation</legend>
                    {slots.length > 0 && (
                      <div className="add-user-field">
                        <label htmlFor="modify-apply-slot">
                          Apply available slot (optional)
                        </label>
                        <select
                          id="modify-apply-slot"
                          defaultValue=""
                          onChange={(event) => {
                            const index = Number(event.target.value);
                            const chosen = slots[index];
                            if (!chosen) return;
                            setModifyDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    date: appliedSearch.date,
                                    partySize: String(appliedSearch.partySize),
                                    startsAt: chosen.startsAt,
                                    tableId: chosen.tableId,
                                    shiftId: chosen.shiftId,
                                    idempotencyKey: nextUuid(),
                                  }
                                : null,
                            );
                          }}
                        >
                          <option value="">Keep custom slot fields</option>
                          {slots.map((slot, index) => (
                            <option
                              key={`${slot.tableId}-${slot.startsAt}`}
                              value={index}
                            >
                              {slot.startsAt} — Table {slot.tableId}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="add-user-field">
                      <label htmlFor="modify-date">Modify date</label>
                      <input
                        id="modify-date"
                        value={modifyDraft.date}
                        onChange={(event) =>
                          setModifyDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  date: event.target.value,
                                  idempotencyKey: nextUuid(),
                                }
                              : null,
                          )
                        }
                      />
                    </div>
                    <div className="add-user-field">
                      <label htmlFor="modify-party-size">
                        Modify party size
                      </label>
                      <input
                        id="modify-party-size"
                        type="number"
                        min={1}
                        max={50}
                        value={modifyDraft.partySize}
                        onChange={(event) =>
                          setModifyDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  partySize: event.target.value,
                                  idempotencyKey: nextUuid(),
                                }
                              : null,
                          )
                        }
                      />
                    </div>
                    <div className="add-user-field">
                      <label htmlFor="modify-starts-at">Modify starts at</label>
                      <input
                        id="modify-starts-at"
                        value={modifyDraft.startsAt}
                        onChange={(event) =>
                          setModifyDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  startsAt: event.target.value,
                                  idempotencyKey: nextUuid(),
                                }
                              : null,
                          )
                        }
                      />
                    </div>
                    <div className="add-user-field">
                      <label htmlFor="modify-table-id">Modify table ID</label>
                      <input
                        id="modify-table-id"
                        value={modifyDraft.tableId}
                        onChange={(event) =>
                          setModifyDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  tableId: event.target.value,
                                  idempotencyKey: nextUuid(),
                                }
                              : null,
                          )
                        }
                      />
                    </div>
                    <div className="add-user-field">
                      <label htmlFor="modify-shift-id">Modify shift ID</label>
                      <input
                        id="modify-shift-id"
                        value={modifyDraft.shiftId}
                        onChange={(event) =>
                          setModifyDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  shiftId: event.target.value,
                                  idempotencyKey: nextUuid(),
                                }
                              : null,
                          )
                        }
                      />
                    </div>
                    <p id="modify-reservation-state">
                      {modifyValidationError ??
                        (modifyDirty ? "Unsaved changes" : "Saved")}
                      {modifyDraft.blocked || modifyStale
                        ? " — Refresh required before saving."
                        : ""}
                    </p>
                    <button
                      type="submit"
                      disabled={
                        !modifyDirty ||
                        modifyStale ||
                        modifyValidationError !== null ||
                        modifyDraft.blocked
                      }
                    >
                      Save reservation changes
                    </button>
                  </fieldset>
                </form>
              ) : (
                <p>
                  This reservation is {selectedReservation.status} and cannot be
                  modified.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
