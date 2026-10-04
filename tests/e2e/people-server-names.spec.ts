import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  serverList,
  serverName,
  serverRoute,
} from "../fixtures/people-server-names";

const api = "**/api/v1/people/server-names**";
const privateError = {
  message: "PRIVATE SQL stack actor venue organization token",
  requestId: "PRIVATE",
};

test("SCR-084 keyboard create/cancel and versioned save use confirmed synthetic responses", async ({
  page,
}) => {
  const writes: { method: string; body: unknown }[] = [];
  await page.route(api, async (route) => {
    const request = route.request();
    const method = request.method();
    const body = serverList();
    if (method !== "GET") {
      writes.push({ method, body: request.postDataJSON() });
      const record =
        method === "POST"
          ? {
              ...serverName,
              id: "00000000-0000-4000-8000-000000000002",
              displayName: "New server",
            }
          : { ...serverName, displayName: "Edited server", version: 2 };
      await route.fulfill({
        status: method === "POST" ? 201 : 200,
        json: record,
      });
      return;
    }
    await route.fulfill({ json: body });
  });
  await page.goto(serverRoute);
  const add = page.getByRole("button", { name: "Add new name" });
  await expect(add).toBeVisible();
  await add.focus();
  await page.keyboard.press("Enter");
  const newInput = page.getByRole("textbox", { name: "New name" });
  await expect(newInput).toBeFocused();
  expect(writes).toEqual([]);
  await newInput.fill("Draft to cancel");
  await page.getByRole("button", { name: "Cancel new name" }).focus();
  await page.keyboard.press("Enter");
  await expect(add).toBeFocused();
  expect(writes).toEqual([]);
  await page.keyboard.press("Enter");
  await expect(newInput).toBeFocused();
  await page.keyboard.type("  New server  ");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Create name" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Name created.")).toBeFocused();
  expect(writes).toEqual([
    { method: "POST", body: { displayName: "New server" } },
  ]);
  const existing = page.getByRole("textbox", { name: "Server name 1" });
  await existing.fill("Edited server");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Save changes for name 1" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Name saved.")).toBeFocused();
  expect(writes[1]).toEqual({
    method: "PATCH",
    body: { displayName: "Edited server", version: 1 },
  });
  await expect(existing).toHaveValue("Edited server");
  await expect(
    page.getByRole("button", { name: "Save changes for name 1" }),
  ).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("SCR-084 duplicate create keeps records independent and create failure focuses a safe alert", async ({
  page,
}) => {
  const writes: unknown[] = [];
  let posts = 0;
  await page.route(api, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: serverList() });
      return;
    }
    posts++;
    writes.push(route.request().postDataJSON());
    await route.fulfill(
      posts === 1
        ? {
            status: 201,
            json: { ...serverName, id: "00000000-0000-4000-8000-000000000002" },
          }
        : { status: 400, json: privateError },
    );
  });
  await page.goto(serverRoute);
  await page.getByRole("button", { name: "Add new name" }).click();
  await page
    .getByRole("textbox", { name: "New name" })
    .fill(serverName.displayName);
  await page.getByRole("button", { name: "Create name" }).click();
  await expect(
    page.getByRole("textbox", { name: "Server name 2" }),
  ).toHaveValue(serverName.displayName);
  expect(writes).toEqual([{ displayName: serverName.displayName }]);
  await page.getByRole("button", { name: "Add new name" }).click();
  await page.getByRole("textbox", { name: "New name" }).fill("Retained");
  await page.getByRole("button", { name: "Create name" }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByRole("textbox", { name: "New name" })).toHaveValue(
    "Retained",
  );
  await expect(page.locator("body")).not.toContainText("PRIVATE");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("SCR-084 cursor paging preserves a dirty row and duplicate names with distinct IDs", async ({
  page,
}) => {
  const queries: string[] = [];
  await page.route(api, async (route) => {
    const url = new URL(route.request().url());
    queries.push(url.search);
    await route.fulfill({
      json: url.searchParams.has("cursor")
        ? serverList([
            { ...serverName, version: 5 },
            { ...serverName, id: "00000000-0000-4000-8000-000000000002" },
          ])
        : serverList([serverName], serverName.id),
    });
  });
  await page.goto(serverRoute);
  await page
    .getByRole("textbox", { name: "Server name 1" })
    .fill("Retained draft");
  await page.getByRole("button", { name: "Add new name" }).click();
  await page
    .getByRole("textbox", { name: "New name" })
    .fill("Retained new draft");
  await page.getByRole("button", { name: "Load more names" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("textbox", { name: "Server name 2" }),
  ).toHaveValue(serverName.displayName);
  await expect(
    page.getByRole("textbox", { name: "Server name 1" }),
  ).toHaveValue("Retained draft");
  await expect(page.getByRole("textbox", { name: "New name" })).toHaveValue(
    "Retained new draft",
  );
  await expect(
    page.getByRole("button", { name: "Load more names" }),
  ).toHaveCount(0);
  expect(
    queries.some(
      (query) => new URLSearchParams(query).get("cursor") === serverName.id,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("SCR-084 empty state and local validation never create on Add or invalid submit", async ({
  page,
}) => {
  let writes = 0;
  await page.route(api, async (route) => {
    if (route.request().method() !== "GET") writes++;
    await route.fulfill({ json: serverList([]) });
  });
  await page.goto(serverRoute);
  await expect(
    page.getByText("No Server Names yet. Add a name to begin."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add new name" }).click();
  const field = page.getByRole("textbox", { name: "New name" });
  await expect(field).toBeFocused();
  await field.fill(" ");
  await expect(
    page.getByRole("button", { name: "Create name" }),
  ).toBeDisabled();
  await field.fill("😀".repeat(121));
  await expect(
    page.getByRole("button", { name: "Create name" }),
  ).toBeDisabled();
  await field.fill("😀".repeat(120));
  await expect(page.getByRole("button", { name: "Create name" })).toBeEnabled();
  expect(writes).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("SCR-084 409 retains draft, focuses alert and refresh requires explicit discard", async ({
  page,
}) => {
  let gets = 0;
  let patches = 0;
  await page.route(api, async (route) => {
    if (route.request().method() === "PATCH") {
      patches++;
      await route.fulfill({ status: 409, json: privateError });
      return;
    }
    gets++;
    await route.fulfill({
      json: serverList([
        {
          ...serverName,
          displayName: patches > 0 ? "Remote server" : serverName.displayName,
          version: patches > 0 ? 8 : 1,
        },
      ]),
    });
  });
  await page.goto(serverRoute);
  const input = page.getByRole("textbox", { name: "Server name 1" });
  await input.fill("Local draft");
  const initialGets = gets;
  await page.getByRole("button", { name: "Save changes for name 1" }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("Your draft is retained");
  await expect(input).toHaveValue("Local draft");
  await expect(
    page.getByRole("button", { name: "Save changes for name 1" }),
  ).toBeDisabled();
  await expect(page.locator("body")).not.toContainText("PRIVATE");
  expect(patches).toBe(1);
  expect(gets).toBe(initialGets);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Refresh names" }).click();
  await expect(
    page.getByRole("button", { name: "Keep editing" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("Local draft");
  expect(gets).toBe(initialGets);
  await page.getByRole("button", { name: "Refresh names" }).click();
  await page.getByRole("button", { name: "Discard edits and refresh" }).focus();
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("Remote server");
  await expect(page.getByText("Names refreshed.")).toBeFocused();
  expect(patches).toBe(1);
  expect(gets).toBe(initialGets + 1);
});

for (const status of [401, 403, 500]) {
  test(`SCR-084 initial ${status} is safe, focused and offers no editor`, async ({
    page,
  }) => {
    await page.route(api, (route) =>
      route.fulfill({ status, json: privateError }),
    );
    await page.goto(serverRoute);
    await expect(page.getByRole("alert")).toBeFocused();
    await expect(page.getByRole("alert")).toContainText(
      status === 401
        ? "Sign in again"
        : status === 403
          ? "do not have access"
          : "could not be saved or loaded",
    );
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("PRIVATE");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
for (const status of [400, 404, 500]) {
  test(`SCR-084 update ${status} preserves the draft and safe error`, async ({
    page,
  }) => {
    await page.route(api, (route) =>
      route.fulfill(
        route.request().method() === "GET"
          ? { json: serverList() }
          : { status, json: privateError },
      ),
    );
    await page.goto(serverRoute);
    const field = page.getByRole("textbox", { name: "Server name 1" });
    await field.fill("Retained draft");
    await page.getByRole("button", { name: "Save changes for name 1" }).click();
    await expect(page.getByRole("alert")).toBeFocused();
    await expect(page.getByRole("alert")).toContainText(
      status === 400
        ? "could not be accepted"
        : status === 404
          ? "unavailable"
          : "could not be saved or loaded",
    );
    await expect(field).toHaveValue("Retained draft");
    await expect(page.locator("body")).not.toContainText("PRIVATE");
  });
}

test("SCR-084 responsive row editor stays within the viewport with accessible focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(api, (route) =>
    route.fulfill({
      json: serverList([{ ...serverName, displayName: "😀".repeat(120) }]),
    }),
  );
  await page.goto(serverRoute);
  await page.getByRole("textbox", { name: "Server name 1" }).focus();
  await expect(
    page.getByRole("textbox", { name: "Server name 1" }),
  ).toBeFocused();
  await expect(
    page.getByText(/lost when you navigate away or reload/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
