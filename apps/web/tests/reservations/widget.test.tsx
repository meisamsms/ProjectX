// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReservationWidgetPage } from "../../src/reservations/widget-page";

const slot = {
  startsAt: "2028-01-15T18:00:00.000Z",
  endsAt: "2028-01-15T19:00:00.000Z",
  timezone: "UTC",
};
const available = {
  venue: { slug: "oak-grill", name: "Oak Grill", timezone: "UTC" },
  items: [slot],
};
const ok = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function search() {
  fireEvent.change(screen.getByLabelText("Date"), {
    target: { value: "2028-01-15" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find available times" }));
  await screen.findByLabelText("Time (UTC)");
}
function details() {
  fireEvent.change(screen.getByLabelText("Time (UTC)"), {
    target: { value: slot.startsAt },
  });
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "ada@example.test" },
  });
}
describe("guest widget", () => {
  it("retains the draft and idempotency key after a failure and only shows server-confirmed success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok(available))
      .mockResolvedValueOnce(ok({}, 500))
      .mockResolvedValueOnce(
        ok(
          {
            status: "BOOKED",
            venueName: "Oak Grill",
            date: "2028-01-15",
            startsAt: slot.startsAt,
            timezone: "UTC",
            confirmationDelivery: "NONE",
          },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<ReservationWidgetPage venueSlug="oak-grill" />);
    await search();
    details();
    fireEvent.click(screen.getByRole("button", { name: "Book reservation" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Reservation booked")).toBeNull();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "Ada",
    );
    fireEvent.click(screen.getByRole("button", { name: "Book reservation" }));
    await screen.findByText("Reservation booked");
    expect(
      screen.getByText("No email or SMS confirmation is sent."),
    ).toBeTruthy();
    const a = JSON.parse(fetchMock.mock.calls[1]?.[1].body),
      b = JSON.parse(fetchMock.mock.calls[2]?.[1].body);
    expect(a).toEqual(b);
    expect(a.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Object.keys(a).sort()).toEqual([
      "date",
      "guestEmail",
      "guestName",
      "idempotencyKey",
      "partySize",
      "startsAt",
    ]);
    expect(fetchMock.mock.calls[1]?.[1].credentials).toBe("omit");
  });
  for (const [status, message] of [
    [404, "unavailable"],
    [409, "no longer available"],
    [429, "Too many requests"],
    [500, "Unable to complete"],
  ] as const)
    it(`safely handles ${status}`, async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(ok(available))
          .mockResolvedValueOnce(ok({}, status)),
      );
      render(<ReservationWidgetPage venueSlug="oak-grill" />);
      await search();
      details();
      fireEvent.click(screen.getByRole("button", { name: "Book reservation" }));
      expect((await screen.findByRole("alert")).textContent).toContain(message);
      expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
        "ada@example.test",
      );
    });
  it("shows empty availability", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(ok({ ...available, items: [] })),
    );
    render(<ReservationWidgetPage venueSlug="oak-grill" />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2028-01-15" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Find available times" }),
    );
    await waitFor(() =>
      expect(screen.getByText(/No available times/)).toBeTruthy(),
    );
  });
  it("shows a safe unavailable message for an unknown or disabled venue", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(ok({ message: "private server details" }, 404));
    vi.stubGlobal("fetch", fetchMock);
    render(<ReservationWidgetPage venueSlug="unknown" />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2028-01-15" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Find available times" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "unavailable",
    );
    expect(document.body.textContent).not.toContain("private server details");
  });
  it("requires a selected time and contact details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(available)));
    render(<ReservationWidgetPage venueSlug="oak-grill" />);
    await search();
    expect(
      (
        screen.getByRole("button", {
          name: "Book reservation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect((screen.getByLabelText("Name") as HTMLInputElement).required).toBe(
      true,
    );
    expect((screen.getByLabelText("Email") as HTMLInputElement).type).toBe(
      "email",
    );
  });
});
