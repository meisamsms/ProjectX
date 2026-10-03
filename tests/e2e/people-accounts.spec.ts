import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const route = "/manager/oceansatarthurs/access/user/list";
const cursor = "00000000-0000-4000-8000-000000000011";
const first = {
  items: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: null,
      jobTitle: null,
      emailNotificationsEnabled: null,
      accessLevels: ["Manager", "Roster"],
    },
  ],
  nextCursor: cursor,
};
const second = {
  items: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Synthetic Person",
      jobTitle: "Host",
      emailNotificationsEnabled: false,
      accessLevels: ["Manager"],
    },
  ],
  nextCursor: null,
};

test("SCR-025 reads authorized synthetic data, filters and advances cursor", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route("**/api/v1/people/accounts*", async (request) => {
    const url = new URL(request.request().url());
    requests.push(url.search);
    const body =
      url.searchParams.has("cursor") || url.searchParams.has("accessLevel")
        ? second
        : first;
    await request.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto(route);
  await expect(
    page.getByRole("heading", { name: "User Accounts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Authorized user accounts" }),
  ).toBeVisible();
  await expect(page.getByText("Not configured")).toBeVisible();
  await expect(page.getByText("Name not supplied")).toBeAttached();
  await expect(page.getByText("Roster")).toBeVisible();
  await expect(page.getByText("Export unavailable")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Disabled")).toBeVisible();
  expect(
    requests.some(
      (query) => new URLSearchParams(query).get("cursor") === cursor,
    ),
  ).toBe(true);
  await expect(page.getByText("End of results")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Access Level (exact role name)" })
    .fill("Manager");
  await page.getByRole("button", { name: "Apply filter" }).click();
  await expect(page.getByText("Access Level filter: Manager")).toBeVisible();
  await expect(page.getByText("Disabled")).toBeVisible();
  expect(
    requests.some((query) => {
      const params = new URLSearchParams(query);
      return params.get("accessLevel") === "Manager" && !params.has("cursor");
    }),
  ).toBe(true);
});

test("SCR-025 denies safely and links to Add User without bypassing authorization", async ({
  page,
}) => {
  await page.route("**/api/v1/people/accounts/options", (request) =>
    request.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        code: "FORBIDDEN",
        message: "People access denied",
        requestId: "synthetic",
      }),
    }),
  );
  await page.route("**/api/v1/people/accounts*", (request) =>
    request.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        code: "FORBIDDEN",
        message: "People access denied",
        requestId: "synthetic",
      }),
    }),
  );
  await page.goto(route);
  await expect(
    page.getByText("You do not have access to user accounts."),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("link", { name: "Add new" }).click();
  await expect(page.getByRole("heading", { name: "Add User" })).toBeVisible();
  await expect(
    page.getByText(
      "You do not have access to add users or assign these selections.",
    ),
  ).toBeVisible();
});

test("SCR-025 loaded roster has no automated accessibility violations", async ({
  page,
}) => {
  await page.route("**/api/v1/people/accounts*", (request) =>
    request.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(first),
    }),
  );
  await page.goto(route);
  await expect(page.getByRole("table")).toBeVisible();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
