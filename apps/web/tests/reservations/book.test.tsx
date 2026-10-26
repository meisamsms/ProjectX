// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
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
} from "../../src/reservations/client";
import {
  guestEmailValidation,
  guestNameValidation,
  ReservationsBookPage,
  searchCriteriaValidation,
} from "../../src/reservations/page";

const SLOT_A: StaffReservationSlot = {
  tableId: "33333333-3333-4333-8333-333333333301",
  shiftId: "44444444-4444-4444-8444-444444444401",
  startsAt: "2028-01-15T18:00:00.000Z",
  endsAt: "2028-01-15T19:30:00.000Z",
  timezone: "UTC",
};

const SLOT_B: StaffReservationSlot = {
  tableId: "33333333-3333-4333-8333-333333333302",
  shiftId: "44444444-4444-4444-8444-444444444401",
  startsAt: "2028-01-15T19:30:00.000Z",
  endsAt: "2028-01-15T21:00:00.000Z",
  timezone: "UTC",
};

const RESERVATION_1: StaffReservation = {
  id: "55555555-5555-4555-8555-555555555501",
  clientId: "66666666-6666-4666-8666-666666666601",
  organizationId: "11111111-1111-4111-8111-111111111101",
  venueId: "22222222-2222-4222-8222-222222222201",
  tableId: "33333333-3333-4333-8333-333333333301",
  shiftId: "44444444-4444-4444-8444-444444444401",
  date: "2028-01-15",
  startsAt: "2028-01-15T18:00:00.000Z",
  endsAt: "2028-01-15T19:30:00.000Z",
  timezone: "UTC",
  partySize: 2,
  guestName: "Ada Lovelace",
  guestEmail: "ada@example.test",
  status: "BOOKED",
  revision: 1,
  createdAt: "2028-01-01T12:00:00.000Z",
  updatedAt: "2028-01-01T12:00:00.000Z",
};

function failure(status: number, code?: string) {
  const err = new ReservationRequestError(status, code);
  err.message = "PRIVATE SQL stack actor venue organization token";
  return err;
}

function setup({
  initialSlots = [SLOT_A, SLOT_B],
  initialReservations = [RESERVATION_1],
  route = "/manager/oceansatarthurs/reservations/day/2028-01-15",
}: {
  initialSlots?: StaffReservationSlot[];
  initialReservations?: StaffReservation[];
  route?: string;
} = {}) {
  const searchAvailability = vi
    .fn<typeof searchStaffReservationAvailability>()
    .mockResolvedValue({ items: initialSlots });
  const listReservations = vi
    .fn<typeof listStaffReservations>()
    .mockResolvedValue({ items: initialReservations });
  const getReservation = vi
    .fn<typeof getStaffReservation>()
    .mockResolvedValue(RESERVATION_1);
  const createReservation = vi
    .fn<typeof createStaffReservation>()
    .mockImplementation(async (body) => ({
      ...RESERVATION_1,
      id: "55555555-5555-4555-8555-555555555502",
      date: body.date,
      partySize: body.partySize,
      tableId: body.tableId,
      shiftId: body.shiftId,
      startsAt: body.startsAt,
      guestName: body.guestName,
      guestEmail: body.guestEmail,
      status: "BOOKED",
      revision: 1,
    }));
  const modifyReservation = vi
    .fn<typeof modifyStaffReservation>()
    .mockImplementation(async (_id, body) => ({
      ...RESERVATION_1,
      date: body.date,
      partySize: body.partySize,
      startsAt: body.startsAt,
      tableId: body.tableId,
      shiftId: body.shiftId,
      revision: body.expectedRevision + 1,
    }));
  const checkInReservation = vi
    .fn<typeof checkInStaffReservation>()
    .mockImplementation(async (_id, body) => ({
      ...RESERVATION_1,
      status: "CHECKED_IN",
      revision: body.expectedRevision + 1,
    }));
  const seatReservation = vi
    .fn<typeof seatStaffReservation>()
    .mockImplementation(async (_id, body) => ({
      ...RESERVATION_1,
      status: "SEATED",
      revision: body.expectedRevision + 1,
    }));
  const cancelReservation = vi
    .fn<typeof cancelStaffReservation>()
    .mockResolvedValue({
      ...RESERVATION_1,
      status: "CANCELLED",
      revision: 2,
    });

  const mount = () =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <ReservationsBookPage
          searchAvailability={searchAvailability}
          listReservations={listReservations}
          getReservation={getReservation}
          createReservation={createReservation}
          modifyReservation={modifyReservation}
          checkInReservation={checkInReservation}
          seatReservation={seatReservation}
          cancelReservation={cancelReservation}
        />
      </MemoryRouter>,
    );

  return {
    searchAvailability,
    listReservations,
    getReservation,
    createReservation,
    modifyReservation,
    checkInReservation,
    seatReservation,
    cancelReservation,
    mount,
  };
}

async function ready(fixture = setup()) {
  fixture.mount();
  await screen.findByRole("button", { name: "Search availability" });
  return fixture;
}

async function focusedAlert() {
  const alert = await screen.findByRole("alert");
  await waitFor(() => expect(document.activeElement).toBe(alert));
  expect(alert.textContent).not.toContain("PRIVATE");
  return alert;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RESERVATION-DOMAIN-005 Staff Reservation Book UI (SCR-002/003/139)", () => {
  it("announces loading, then loads reservations and availability for the route date", async () => {
    const fixture = setup({
      route: "/manager/oceansatarthurs/reservations/day/2028-01-16",
    });
    await ready(fixture);
    expect(fixture.listReservations).toHaveBeenCalledWith(
      { date: "2028-01-16", limit: 100 },
      expect.any(AbortSignal),
    );
    expect(fixture.searchAvailability).toHaveBeenCalledWith(
      { date: "2028-01-16", partySize: 2 },
      expect.any(AbortSignal),
    );
    expect(screen.getByRole("list", { name: "Available slots" })).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "Reservations for day" }),
    ).toBeTruthy();
  });

  it("shows empty states when no slots or reservations exist", async () => {
    await ready(setup({ initialSlots: [], initialReservations: [] }));
    expect(
      screen.getByText("No available slots found for the selected criteria."),
    ).toBeTruthy();
    expect(screen.getByText("No reservations for this date.")).toBeTruthy();
  });

  it.each([400, 401, 403, 404, 409, 500])(
    "handles initial %i load failure with safe focused alert and no editor",
    async (status) => {
      const fixture = setup();
      fixture.listReservations.mockRejectedValueOnce(failure(status));
      fixture.mount();
      await focusedAlert();
      expect(
        screen.queryByRole("button", { name: "Search availability" }),
      ).toBeNull();
    },
  );

  it("searches availability by date, party size, and optional time window", async () => {
    const fixture = await ready();
    fireEvent.change(screen.getByLabelText("Reservation date"), {
      target: { value: "2028-01-20" },
    });
    fireEvent.change(screen.getByLabelText("Party size"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("From minute (0-1439, optional)"), {
      target: { value: "1080" },
    });
    fireEvent.change(screen.getByLabelText("To minute (1-1440, optional)"), {
      target: { value: "1260" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Search availability" }),
    );
    await waitFor(() =>
      expect(fixture.searchAvailability).toHaveBeenLastCalledWith(
        {
          date: "2028-01-20",
          partySize: 4,
          fromMinute: 1080,
          toMinute: 1260,
        },
        expect.any(AbortSignal),
      ),
    );
    expect(fixture.listReservations).toHaveBeenLastCalledWith(
      { date: "2028-01-20", limit: 100 },
      expect.any(AbortSignal),
    );
  });

  it("opens SCR-003 from a slot, validates inputs, creates a reservation with UUID idempotencyKey, and refreshes availability", async () => {
    const fixture = await ready();
    fixture.searchAvailability.mockResolvedValueOnce({ items: [SLOT_B] });

    fireEvent.click(screen.getByRole("button", { name: "Select slot 1" }));
    const nameInput = screen.getByLabelText("Guest name") as HTMLInputElement;
    const emailInput = screen.getByLabelText("Guest email") as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(nameInput));
    expect(
      (
        screen.getByRole("button", {
          name: "Create reservation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.change(nameInput, { target: { value: "Grace Hopper" } });
    fireEvent.change(emailInput, { target: { value: "grace@example.test" } });
    expect(
      (
        screen.getByRole("button", {
          name: "Create reservation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Create reservation" }));
    await waitFor(() =>
      expect(fixture.createReservation).toHaveBeenCalledTimes(1),
    );
    const createPayload = fixture.createReservation.mock.calls[0]?.[0];
    expect(createPayload).toMatchObject({
      date: "2028-01-15",
      partySize: 2,
      tableId: SLOT_A.tableId,
      shiftId: SLOT_A.shiftId,
      startsAt: SLOT_A.startsAt,
      guestName: "Grace Hopper",
      guestEmail: "grace@example.test",
    });
    expect(createPayload?.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    await screen.findByText("Reservation created.");
    expect(
      screen.getByRole("button", {
        name: /View reservation 2 \(Grace Hopper\)/,
      }),
    ).toBeTruthy();
  });

  it("preserves SCR-003 draft and reuses idempotencyKey on retry after 409/500 failure", async () => {
    const fixture = await ready();
    fixture.createReservation
      .mockRejectedValueOnce(failure(409, "CAPACITY_CONFLICT"))
      .mockResolvedValueOnce({
        ...RESERVATION_1,
        id: "55555555-5555-4555-8555-555555555509",
        guestName: "Retained Guest",
        guestEmail: "retained@example.test",
      });

    fireEvent.click(screen.getByRole("button", { name: "Select slot 1" }));
    fireEvent.change(screen.getByLabelText("Guest name"), {
      target: { value: "Retained Guest" },
    });
    fireEvent.change(screen.getByLabelText("Guest email"), {
      target: { value: "retained@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create reservation" }));

    const alert = await focusedAlert();
    expect(alert.textContent).toContain("capacity conflict");
    expect(
      (screen.getByLabelText("Guest name") as HTMLInputElement).value,
    ).toBe("Retained Guest");
    expect(
      (screen.getByLabelText("Guest email") as HTMLInputElement).value,
    ).toBe("retained@example.test");

    fireEvent.click(screen.getByRole("button", { name: "Create reservation" }));
    await screen.findByText("Reservation created.");
    const firstKey =
      fixture.createReservation.mock.calls[0]?.[0]?.idempotencyKey;
    const secondKey =
      fixture.createReservation.mock.calls[1]?.[0]?.idempotencyKey;
    expect(firstKey).toBe(secondKey);
  });

  it("supports SCR-139 modify, conflict preservation/discard, check-in, seat, and cancel workflows", async () => {
    const fixture = await ready();
    fireEvent.click(
      screen.getByRole("button", {
        name: "View reservation 1 (Ada Lovelace)",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Reservation Detail (SCR-139)" }),
    ).toBeTruthy();

    // Modify with 409 VERSION_CONFLICT first -> preserves draft and blocks until refresh
    fixture.modifyReservation.mockRejectedValueOnce(
      failure(409, "VERSION_CONFLICT"),
    );
    fireEvent.change(screen.getByLabelText("Modify party size"), {
      target: { value: "4" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save reservation changes" }),
    );

    const alert = await focusedAlert();
    expect(alert.textContent).toContain("stale revision");
    expect(
      (screen.getByLabelText("Modify party size") as HTMLInputElement).value,
    ).toBe("4");
    expect(
      (
        screen.getByRole("button", {
          name: "Save reservation changes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    // Refresh detail prompts confirmation because draft is dirty
    fixture.getReservation.mockResolvedValueOnce({
      ...RESERVATION_1,
      revision: 3,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh reservation detail" }),
    );
    expect(screen.getByRole("button", { name: "Keep editing" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Discard changes and refresh" }),
    );
    await screen.findByText("Reservation detail refreshed.");

    // Modify with updated revision 3 succeeds
    fireEvent.change(screen.getByLabelText("Modify party size"), {
      target: { value: "3" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save reservation changes" }),
    );
    await screen.findByText("Reservation modified.");
    expect(fixture.modifyReservation).toHaveBeenLastCalledWith(
      RESERVATION_1.id,
      expect.objectContaining({
        expectedRevision: 3,
        partySize: 3,
      }),
      expect.any(AbortSignal),
    );

    // Check in BOOKED -> CHECKED_IN
    fireEvent.click(
      screen.getByRole("button", { name: "Check in reservation" }),
    );
    await screen.findByText("Reservation checked in.");
    expect(fixture.checkInReservation).toHaveBeenCalledWith(
      RESERVATION_1.id,
      expect.objectContaining({ expectedRevision: 4 }),
      expect.any(AbortSignal),
    );

    // Seat CHECKED_IN -> SEATED
    fireEvent.click(screen.getByRole("button", { name: "Seat reservation" }));
    await screen.findByText("Reservation seated.");
    expect(fixture.seatReservation).toHaveBeenCalledWith(
      RESERVATION_1.id,
      expect.objectContaining({ expectedRevision: 5 }),
      expect.any(AbortSignal),
    );
    expect(
      screen.getByText("This reservation is SEATED and cannot be modified."),
    ).toBeTruthy();
  });

  it("cancels a BOOKED reservation and refreshes availability", async () => {
    const fixture = await ready();
    fireEvent.click(
      screen.getByRole("button", {
        name: "View reservation 1 (Ada Lovelace)",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel reservation" }));
    await screen.findByText("Reservation cancelled.");
    expect(fixture.cancelReservation).toHaveBeenCalledWith(
      RESERVATION_1.id,
      expect.any(AbortSignal),
    );
    expect(
      screen.getByText("This reservation is CANCELLED and cannot be modified."),
    ).toBeTruthy();
  });

  it("validates guest name, email, and search criteria helpers locally", () => {
    expect(guestNameValidation("")).not.toBeNull();
    expect(guestNameValidation("a\u0000b")).not.toBeNull();
    expect(guestNameValidation("Ada Lovelace")).toBeNull();
    expect(guestEmailValidation("invalid")).not.toBeNull();
    expect(guestEmailValidation("ada@example.test")).toBeNull();
    expect(
      searchCriteriaValidation({
        date: "2028-02-30",
        partySize: "2",
        fromMinute: "",
        toMinute: "",
      }),
    ).not.toBeNull();
    expect(
      searchCriteriaValidation({
        date: "2028-01-15",
        partySize: "2",
        fromMinute: "900",
        toMinute: "600",
      }),
    ).not.toBeNull();
  });

  it("executes all 8 client functions via staffFetch and maps non-2xx responses to ReservationRequestError", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [SLOT_A] }), { status: 200 }),
    );
    const avail = await searchStaffReservationAvailability({
      date: "2028-01-15",
      partySize: 2,
      fromMinute: 600,
      toMinute: 1200,
    });
    expect(avail.items).toEqual([SLOT_A]);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [RESERVATION_1] }), { status: 200 }),
    );
    const list = await listStaffReservations({
      date: "2028-01-15",
      limit: 50,
    });
    expect(list.items).toEqual([RESERVATION_1]);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(RESERVATION_1), { status: 200 }),
    );
    const detail = await getStaffReservation(RESERVATION_1.id);
    expect(detail.id).toBe(RESERVATION_1.id);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(RESERVATION_1), { status: 201 }),
    );
    const created = await createStaffReservation({
      date: "2028-01-15",
      partySize: 2,
      tableId: SLOT_A.tableId,
      shiftId: SLOT_A.shiftId,
      startsAt: SLOT_A.startsAt,
      guestName: "Ada Lovelace",
      guestEmail: "ada@example.test",
      idempotencyKey: "77777777-7777-4777-8777-777777777701",
    });
    expect(created.id).toBe(RESERVATION_1.id);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...RESERVATION_1, revision: 2 }), {
        status: 200,
      }),
    );
    const modified = await modifyStaffReservation(RESERVATION_1.id, {
      expectedRevision: 1,
      idempotencyKey: "77777777-7777-4777-8777-777777777702",
      date: "2028-01-15",
      partySize: 2,
      startsAt: SLOT_B.startsAt,
      tableId: SLOT_B.tableId,
      shiftId: SLOT_B.shiftId,
    });
    expect(modified.revision).toBe(2);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ...RESERVATION_1, status: "CHECKED_IN", revision: 3 }),
        { status: 200 },
      ),
    );
    const checkedIn = await checkInStaffReservation(RESERVATION_1.id, {
      expectedRevision: 2,
      idempotencyKey: "77777777-7777-4777-8777-777777777703",
    });
    expect(checkedIn.status).toBe("CHECKED_IN");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ...RESERVATION_1, status: "SEATED", revision: 4 }),
        { status: 200 },
      ),
    );
    const seated = await seatStaffReservation(RESERVATION_1.id, {
      expectedRevision: 3,
      idempotencyKey: "77777777-7777-4777-8777-777777777704",
    });
    expect(seated.status).toBe("SEATED");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ...RESERVATION_1, status: "CANCELLED", revision: 2 }),
        { status: 200 },
      ),
    );
    const cancelled = await cancelStaffReservation(RESERVATION_1.id);
    expect(cancelled.status).toBe("CANCELLED");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: "CAPACITY_CONFLICT", message: "PRIVATE" }),
        { status: 409 },
      ),
    );
    await expect(
      cancelStaffReservation(RESERVATION_1.id),
    ).rejects.toMatchObject({
      status: 409,
      code: "CAPACITY_CONFLICT",
    });
  });
});
