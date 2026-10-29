import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const reservationsRoute =
  "/manager/oceansatarthurs/reservations/day/2028-01-15";
const apiPattern = "**/api/v1/staff/reservations**";

const slotA = {
  tableId: "33333333-3333-4333-8333-333333333301",
  shiftId: "44444444-4444-4444-8444-444444444401",
  startsAt: "2028-01-15T18:00:00.000Z",
  endsAt: "2028-01-15T19:30:00.000Z",
  timezone: "UTC",
};

const slotB = {
  tableId: "33333333-3333-4333-8333-333333333302",
  shiftId: "44444444-4444-4444-8444-444444444401",
  startsAt: "2028-01-15T19:30:00.000Z",
  endsAt: "2028-01-15T21:00:00.000Z",
  timezone: "UTC",
};

const baseReservation = {
  id: "55555555-5555-4555-8555-555555555501",
  clientId: "66666666-6666-4666-8666-666666666601",
  organizationId: "11111111-1111-4111-8111-111111111101",
  venueId: "22222222-2222-4222-8222-222222222201",
  tableId: slotA.tableId,
  shiftId: slotA.shiftId,
  date: "2028-01-15",
  startsAt: slotA.startsAt,
  endsAt: slotA.endsAt,
  timezone: "UTC",
  partySize: 2,
  guestName: "Ada Lovelace",
  guestEmail: "ada@example.test",
  status: "BOOKED" as const,
  revision: 1,
  createdAt: "2028-01-01T12:00:00.000Z",
  updatedAt: "2028-01-01T12:00:00.000Z",
};

const privateError = {
  code: "INTERNAL_ERROR",
  message: "PRIVATE SQL stack actor venue organization token",
  requestId: "PRIVATE",
};

test("SCR-002/003/139 supports availability search, create, modify, check-in, seat, cancel and axe accessibility", async ({
  page,
}) => {
  const writes: { method: string; path: string; body: unknown }[] = [];
  let currentReservation = { ...baseReservation };
  let createdReservation: typeof baseReservation | null = null;

  await page.route(apiPattern, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (
      method === "GET" &&
      url.pathname === "/api/v1/staff/reservations/availability"
    ) {
      await route.fulfill({
        json: {
          items: createdReservation ? [slotB] : [slotA, slotB],
        },
      });
      return;
    }

    if (method === "GET" && url.pathname === "/api/v1/staff/reservations") {
      await route.fulfill({
        json: {
          items: createdReservation
            ? [currentReservation, createdReservation]
            : [currentReservation],
        },
      });
      return;
    }

    const body = request.postDataJSON();
    writes.push({ method, path: url.pathname, body });

    if (method === "POST" && url.pathname === "/api/v1/staff/reservations") {
      createdReservation = {
        ...baseReservation,
        id: "55555555-5555-4555-8555-555555555502",
        tableId: body.tableId,
        shiftId: body.shiftId,
        startsAt: body.startsAt,
        partySize: body.partySize,
        guestName: body.guestName,
        guestEmail: body.guestEmail,
        status: "BOOKED",
        revision: 1,
      };
      await route.fulfill({ status: 201, json: createdReservation });
      return;
    }

    if (
      method === "PATCH" &&
      url.pathname === `/api/v1/staff/reservations/${currentReservation.id}`
    ) {
      currentReservation = {
        ...currentReservation,
        date: body.date,
        partySize: body.partySize,
        startsAt: body.startsAt,
        tableId: body.tableId,
        shiftId: body.shiftId,
        revision: body.expectedRevision + 1,
      };
      await route.fulfill({ status: 200, json: currentReservation });
      return;
    }

    if (
      method === "POST" &&
      url.pathname ===
        `/api/v1/staff/reservations/${currentReservation.id}/check-in`
    ) {
      currentReservation = {
        ...currentReservation,
        status: "CHECKED_IN",
        revision: body.expectedRevision + 1,
      };
      await route.fulfill({ status: 200, json: currentReservation });
      return;
    }

    if (
      method === "POST" &&
      url.pathname ===
        `/api/v1/staff/reservations/${currentReservation.id}/seat`
    ) {
      currentReservation = {
        ...currentReservation,
        status: "SEATED",
        revision: body.expectedRevision + 1,
      };
      await route.fulfill({ status: 200, json: currentReservation });
      return;
    }

    if (
      method === "POST" &&
      createdReservation &&
      url.pathname ===
        `/api/v1/staff/reservations/${createdReservation.id}/cancel`
    ) {
      createdReservation = {
        ...createdReservation,
        status: "CANCELLED",
        revision: createdReservation.revision + 1,
      };
      await route.fulfill({ status: 200, json: createdReservation });
      return;
    }

    await route.fulfill({ status: 404, json: privateError });
  });

  await page.goto(reservationsRoute);
  await expect(
    page.getByRole("heading", { name: "Reservations Day Book" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Open SCR-003 Add Reservation from Slot 2
  await page.getByRole("button", { name: "Select slot 2" }).click();
  const guestName = page.getByLabel("Guest name");
  await expect(guestName).toBeFocused();
  await guestName.fill("Grace Hopper");
  await page.getByLabel("Guest email").fill("grace@example.test");
  await page.getByRole("button", { name: "Create reservation" }).click();
  await expect(page.getByText("Reservation created.")).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Cancel the newly created reservation in SCR-139
  await page.getByRole("button", { name: "Cancel reservation" }).click();
  await expect(page.getByText("Reservation cancelled.")).toBeFocused();
  await expect(
    page.getByText("This reservation is CANCELLED and cannot be modified."),
  ).toBeVisible();

  // Select Reservation 1 (Ada Lovelace) -> Modify -> Check in -> Seat
  await page
    .getByRole("button", { name: "View reservation 1 (Ada Lovelace)" })
    .click();
  await page.getByLabel("Modify party size").fill("4");
  await page.getByRole("button", { name: "Save reservation changes" }).click();
  await expect(page.getByText("Reservation modified.")).toBeFocused();

  await page.getByRole("button", { name: "Check in reservation" }).click();
  await expect(page.getByText("Reservation checked in.")).toBeFocused();

  await page.getByRole("button", { name: "Seat reservation" }).click();
  await expect(page.getByText("Reservation seated.")).toBeFocused();
  await expect(
    page.getByText("This reservation is SEATED and cannot be modified."),
  ).toBeVisible();

  expect(writes).toHaveLength(5);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("SCR-139 409 VERSION_CONFLICT preserves draft, focuses alert, and requires explicit discard on refresh", async ({
  page,
}) => {
  let patches = 0;
  await page.route(apiPattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "PATCH") {
      patches++;
      await route.fulfill({
        status: 409,
        json: {
          ...privateError,
          code: "VERSION_CONFLICT",
        },
      });
      return;
    }
    if (url.pathname.endsWith("/availability")) {
      await route.fulfill({ json: { items: [slotA] } });
      return;
    }
    if (url.pathname.endsWith(baseReservation.id)) {
      await route.fulfill({
        json: { ...baseReservation, partySize: 6, revision: 4 },
      });
      return;
    }
    await route.fulfill({ json: { items: [baseReservation] } });
  });

  await page.goto(reservationsRoute);
  await page
    .getByRole("button", { name: "View reservation 1 (Ada Lovelace)" })
    .click();
  const partyInput = page.getByLabel("Modify party size");
  await partyInput.fill("5");
  await page.getByRole("button", { name: "Save reservation changes" }).click();

  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("stale revision");
  await expect(partyInput).toHaveValue("5");
  await expect(page.locator("body")).not.toContainText("PRIVATE");
  expect(patches).toBe(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page
    .getByRole("button", { name: "Refresh reservation detail" })
    .click();
  await expect(
    page.getByRole("button", { name: "Keep editing" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(partyInput).toHaveValue("5");

  await page
    .getByRole("button", { name: "Refresh reservation detail" })
    .click();
  await page
    .getByRole("button", { name: "Discard changes and refresh" })
    .click();
  await expect(page.getByText("Reservation detail refreshed.")).toBeFocused();
  await expect(partyInput).toHaveValue("6");
});

test("search refresh preserves the draft revision and blocks stale allocation until explicit reload", async ({
  page,
}) => {
  const newer = { ...baseReservation, ...slotB, revision: 2 };
  let changedByOtherStaff = false;
  const patches: {
    expectedRevision: number;
    tableId: string;
    startsAt: string;
    partySize: number;
  }[] = [];
  await page.route(apiPattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "PATCH") {
      const body = request.postDataJSON();
      patches.push(body);
      await route.fulfill({ json: { ...newer, ...body, revision: 3 } });
    } else if (url.pathname.endsWith("/availability")) {
      await route.fulfill({ json: { items: [slotA, slotB] } });
    } else if (url.pathname.endsWith(baseReservation.id)) {
      await route.fulfill({ json: newer });
    } else {
      await route.fulfill({
        json: { items: [changedByOtherStaff ? newer : baseReservation] },
      });
    }
  });
  await page.goto(reservationsRoute);
  await page
    .getByRole("button", { name: "View reservation 1 (Ada Lovelace)" })
    .click();
  await page.getByLabel("Modify party size").fill("4");
  changedByOtherStaff = true;
  await page
    .getByRole("button", { name: "Search availability", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("changed elsewhere");
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Modify table ID")).toHaveValue(slotA.tableId);
  await expect(page.getByLabel("Modify party size")).toHaveValue("4");
  await expect(
    page.getByRole("button", { name: "Save reservation changes" }),
  ).toBeDisabled();
  expect(patches).toHaveLength(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button", { name: "Refresh reservation detail" })
    .click();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Modify party size")).toHaveValue("4");
  await page
    .getByRole("button", { name: "Refresh reservation detail" })
    .click();
  await page
    .getByRole("button", { name: "Discard changes and refresh" })
    .click();
  await expect(page.getByLabel("Modify table ID")).toHaveValue(slotB.tableId);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByLabel("Modify party size").fill("3");
  await page.getByRole("button", { name: "Save reservation changes" }).click();
  await expect(page.getByText("Reservation modified.")).toBeVisible();
  expect(patches).toEqual([
    expect.objectContaining({
      expectedRevision: 2,
      tableId: slotB.tableId,
      startsAt: slotB.startsAt,
      partySize: 3,
    }),
  ]);
});

for (const status of [401, 403, 500]) {
  test(`SCR-002 initial ${status} failure is safe, focused, and hides editors`, async ({
    page,
  }) => {
    await page.route(apiPattern, (route) =>
      route.fulfill({ status, json: privateError }),
    );
    await page.goto(reservationsRoute);
    await expect(page.getByRole("alert")).toBeFocused();
    await expect(page.locator("body")).not.toContainText("PRIVATE");
    await expect(
      page.getByRole("button", { name: "Search availability" }),
    ).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

for (const status of [400, 403, 409, 500]) {
  test(`SCR-003 create ${status} failure preserves unsaved draft and focuses safe alert`, async ({
    page,
  }) => {
    await page.route(apiPattern, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "POST") {
        await route.fulfill({
          status,
          json:
            status === 409
              ? { ...privateError, code: "CAPACITY_CONFLICT" }
              : privateError,
        });
        return;
      }
      if (url.pathname.endsWith("/availability")) {
        await route.fulfill({ json: { items: [slotA] } });
        return;
      }
      await route.fulfill({ json: { items: [baseReservation] } });
    });

    await page.goto(reservationsRoute);
    await page.getByRole("button", { name: "Select slot 1" }).click();
    await page.getByLabel("Guest name").fill("Draft Guest");
    await page.getByLabel("Guest email").fill("draft@example.test");
    await page.getByRole("button", { name: "Create reservation" }).click();

    await expect(page.getByRole("alert")).toBeFocused();
    await expect(page.getByLabel("Guest name")).toHaveValue("Draft Guest");
    await expect(page.getByLabel("Guest email")).toHaveValue(
      "draft@example.test",
    );
    await expect(page.locator("body")).not.toContainText("PRIVATE");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
