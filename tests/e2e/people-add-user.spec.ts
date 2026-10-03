import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { created, first, options } from "../fixtures/people-add-user";

const route = "/manager/oceansatarthurs/access/user/create";
async function stub(page: Page, status = 201) {
  await page.route("**/api/v1/people/accounts/options", (request) =>
    request.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(options),
    }),
  );
  await page.route("**/api/v1/people/accounts", (request) =>
    request.fulfill({
      status: request.request().method() === "POST" ? status : 200,
      contentType: "application/json",
      body: JSON.stringify(
        request.request().method() === "POST"
          ? status === 201
            ? created
            : { message: "SQL RLS issuer subject foreign tenant" }
          : { items: [], nextCursor: null },
      ),
    }),
  );
}
async function fill(page: Page) {
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("synthetic@example.test");
  await page
    .getByRole("checkbox", { name: "Synthetic organization role" })
    .check();
}
test("SCR-026 loads authorized options and Create navigates to SCR-025", async ({
  page,
}) => {
  await stub(page);
  await page.goto(route);
  await expect(page.getByRole("heading", { name: "Add User" })).toBeVisible();
  await fill(page);
  await page.getByRole("checkbox", { name: /Read synthetic roster/ }).check();
  await page
    .getByRole("checkbox", { name: "Synthetic venue", exact: true })
    .check();
  await page.getByRole("checkbox", { name: "Synthetic venue role" }).check();
  await page.getByRole("checkbox", { name: "Read synthetic venue" }).check();
  const request = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/people/accounts"),
  );
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const posted = await request;
  expect(posted.postDataJSON()).toMatchObject({
    emailNotificationsEnabled: null,
    organizationPermissionIds: ["user.read"],
    venues: [
      {
        venueId: first(options.venues).id,
        roleIds: [first(first(options.venues).roles).id],
        permissionIds: ["venue.read"],
      },
    ],
  });
  expect(posted.headers()["idempotency-key"]).toBeTruthy();
  await expect(page).toHaveURL(/access\/user\/list$/);
  await expect(
    page.getByRole("heading", { name: "User Accounts" }),
  ).toBeVisible();
});
test("Add Another clears private fields and grants, keeps route and creates a fresh request boundary", async ({
  page,
}) => {
  await stub(page);
  const keys: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST")
      keys.push(request.headers()["idempotency-key"] ?? "");
  });
  await page.goto(route);
  await fill(page);
  await page.getByRole("textbox", { name: "First Name" }).fill("Synthetic");
  await page.getByRole("textbox", { name: "Last Name" }).fill("Example");
  await page.getByRole("textbox", { name: "Job Title" }).fill("Host");
  await page
    .getByRole("combobox", { name: "Email Notifications" })
    .selectOption("true");
  await page.getByRole("checkbox", { name: "Disabled at creation" }).check();
  await page.getByRole("checkbox", { name: /Read synthetic roster/ }).check();
  await page
    .getByRole("checkbox", { name: "Synthetic venue", exact: true })
    .check();
  await page.getByRole("checkbox", { name: "Synthetic venue role" }).check();
  await page.getByRole("checkbox", { name: "Read synthetic venue" }).check();
  await page.getByRole("button", { name: "Create + Add Another" }).click();
  await expect(page.getByText(/Pending account created/)).toBeFocused();
  await expect(page).toHaveURL(/access\/user\/create$/);
  for (const label of ["Email", "First Name", "Last Name", "Job Title"])
    await expect(
      page.getByRole("textbox", { name: label, exact: true }),
    ).toHaveValue("");
  await expect(page.getByRole("combobox")).toHaveValue("null");
  for (const checkbox of await page.getByRole("checkbox").all())
    await expect(checkbox).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Read synthetic venue" }),
  ).toHaveCount(0);
  await fill(page);
  await page.getByRole("button", { name: "Create + Add Another" }).click();
  await expect(page.getByText(/Pending account created/)).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).not.toBe(keys[1]);
});
test("conflict is safely announced and keyboard-operable with no sensitive metadata", async ({
  page,
}) => {
  await stub(page, 409);
  await page.goto(route);
  await fill(page);
  const role = page.getByRole("checkbox", {
    name: "Synthetic organization role",
  });
  await role.focus();
  await page.keyboard.press("Space");
  await expect(role).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(role).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("checkbox", { name: /Read synthetic roster/ }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("conflicted");
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.locator("body")).not.toContainText(
    "SQL RLS issuer subject foreign tenant",
  );
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});
test("SCR-026 baseline and venue-expanded form pass axe at responsive width", async ({
  page,
}) => {
  await stub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route);
  await page
    .getByRole("checkbox", { name: "Synthetic venue", exact: true })
    .check();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  await expect(
    page.getByText(/Mobile MFA and Email Subscriptions are unavailable/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
