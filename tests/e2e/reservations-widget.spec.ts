import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("guest books from the public route with accessible states and truthful confirmation", async ({
  page,
}) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/public/venues/oak-grill/**", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: {
          venue: { slug: "oak-grill", name: "Oak Grill", timezone: "UTC" },
          items: [
            {
              startsAt: "2028-01-15T18:00:00.000Z",
              endsAt: "2028-01-15T19:00:00.000Z",
              timezone: "UTC",
            },
          ],
        },
      });
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1)
      return route.fulfill({
        status: 409,
        json: { code: "CAPACITY_CONFLICT" },
      });
    return route.fulfill({
      status: 201,
      json: {
        reservationId: "11111111-1111-4111-8111-111111111111",
        venueSlug: "oak-grill",
        venueName: "Oak Grill",
        date: "2028-01-15",
        startsAt: "2028-01-15T18:00:00.000Z",
        endsAt: "2028-01-15T19:00:00.000Z",
        timezone: "UTC",
        partySize: 2,
        guestName: "Ada",
        status: "BOOKED",
        confirmationDelivery: "NONE",
      },
    });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/book/oak-grill");
  await page.getByLabel("Date").fill("2028-01-15");
  await page.getByRole("button", { name: "Find available times" }).click();
  await page.getByLabel("Time (UTC)").selectOption("2028-01-15T18:00:00.000Z");
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill("ada@example.test");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Book reservation" }).click();
  await expect(page.getByRole("alert")).toContainText("no longer available");
  await expect(page.getByLabel("Name")).toHaveValue("Ada");
  await page.getByRole("button", { name: "Book reservation" }).click();
  await expect(
    page.getByRole("heading", { name: "Reservation booked" }),
  ).toBeVisible();
  await expect(
    page.getByText("No email or SMS confirmation is sent."),
  ).toBeVisible();
  expect(bodies[0]).toEqual(bodies[1]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
