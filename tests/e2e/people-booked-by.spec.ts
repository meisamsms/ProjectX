import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  bookedList,
  bookedName,
  bookedRoute,
} from "../fixtures/people-booked-by";

const api = "**/api/v1/people/booked-by-names**";
const privateError = {
  message: "PRIVATE SQL stack actor venue organization token",
  requestId: "PRIVATE",
};

test("SCR-083 keyboard create/cancel and versioned save use confirmed synthetic responses", async ({
  page,
}) => {
  const writes: { method: string; body: unknown }[] = [];
  await page.route(api, async (route) => {
    const request = route.request();
    const method = request.method();
    const body = bookedList();
    if (method !== "GET") {
      writes.push({ method, body: request.postDataJSON() });
      const record =
        method === "POST"
          ? {
              ...bookedName,
              id: "00000000-0000-4000-8000-000000000002",
              displayName: "New host",
            }
          : { ...bookedName, displayName: "Edited host", version: 2 };
      await route.fulfill({
        status: method === "POST" ? 201 : 200,
        json: record,
      });
      return;
    }
    await route.fulfill({ json: body });
  });
  await page.goto(bookedRoute);
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
  await page.keyboard.type("  New host  ");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Create name" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Name created.")).toBeFocused();
  expect(writes).toEqual([
    { method: "POST", body: { displayName: "New host" } },
  ]);
  const existing = page.getByRole("textbox", { name: "Booked By Name 1" });
  await existing.fill("Edited host");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Save changes for name 1" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Name saved.")).toBeFocused();
  expect(writes[1]).toEqual({
    method: "PATCH",
    body: { displayName: "Edited host", version: 1 },
  });
  await expect(existing).toHaveValue("Edited host");
  await expect(
    page.getByRole("button", { name: "Save changes for name 1" }),
  ).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("SCR-083 cursor paging preserves a dirty row and duplicate names with distinct IDs", async ({
  page,
}) => {
  const queries: string[] = [];
  await page.route(api, async (route) => {
    const url = new URL(route.request().url());
    queries.push(url.search);
    await route.fulfill({
      json: url.searchParams.has("cursor")
        ? bookedList([
            { ...bookedName, version: 5 },
            { ...bookedName, id: "00000000-0000-4000-8000-000000000002" },
          ])
        : bookedList([bookedName], bookedName.id),
    });
  });
  await page.goto(bookedRoute);
  await page
    .getByRole("textbox", { name: "Booked By Name 1" })
    .fill("Retained draft");
  await page.getByRole("button", { name: "Load more names" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("textbox", { name: "Booked By Name 2" }),
  ).toHaveValue(bookedName.displayName);
  await expect(
    page.getByRole("textbox", { name: "Booked By Name 1" }),
  ).toHaveValue("Retained draft");
  await expect(
    page.getByRole("button", { name: "Load more names" }),
  ).toHaveCount(0);
  expect(
    queries.some(
      (query) => new URLSearchParams(query).get("cursor") === bookedName.id,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("SCR-083 empty state and local validation never create on Add or invalid submit", async ({
  page,
}) => {
  let writes = 0;
  await page.route(api, async (route) => {
    if (route.request().method() !== "GET") writes++;
    await route.fulfill({ json: bookedList([]) });
  });
  await page.goto(bookedRoute);
  await expect(
    page.getByText("No Booked By Names yet. Add a name to begin."),
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

test("SCR-083 409 retains draft, focuses alert and refresh requires explicit discard", async ({
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
      json: bookedList([
        {
          ...bookedName,
          displayName: patches > 0 ? "Remote host" : bookedName.displayName,
          version: patches > 0 ? 8 : 1,
        },
      ]),
    });
  });
  await page.goto(bookedRoute);
  const input = page.getByRole("textbox", { name: "Booked By Name 1" });
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
  await expect(input).toHaveValue("Remote host");
  await expect(page.getByText("Names refreshed.")).toBeFocused();
  expect(patches).toBe(1);
  expect(gets).toBe(initialGets + 1);
});

for (const status of [401, 403, 500]) {
  test(`SCR-083 initial ${status} is safe, focused and offers no editor`, async ({
    page,
  }) => {
    await page.route(api, (route) =>
      route.fulfill({ status, json: privateError }),
    );
    await page.goto(bookedRoute);
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
  test(`SCR-083 update ${status} preserves the draft and safe error`, async ({
    page,
  }) => {
    await page.route(api, (route) =>
      route.fulfill(
        route.request().method() === "GET"
          ? { json: bookedList() }
          : { status, json: privateError },
      ),
    );
    await page.goto(bookedRoute);
    const field = page.getByRole("textbox", { name: "Booked By Name 1" });
    await field.fill("Retained draft");
    await page.getByRole("button", { name: "Save changes for name 1" }).click();
    await expect(page.getByRole("alert")).toBeFocused();
    await expect(page.getByRole("alert")).toContainText(
      status === 400
        ? "could not be accepted"
        : status === 404
          ? "no longer available"
          : "could not be saved or loaded",
    );
    await expect(field).toHaveValue("Retained draft");
    await expect(page.locator("body")).not.toContainText("PRIVATE");
  });
}

test("SCR-083 responsive row editor stays within the viewport with accessible focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(api, (route) =>
    route.fulfill({
      json: bookedList([{ ...bookedName, displayName: "😀".repeat(120) }]),
    }),
  );
  await page.goto(bookedRoute);
  await page.getByRole("textbox", { name: "Booked By Name 1" }).focus();
  await expect(
    page.getByRole("textbox", { name: "Booked By Name 1" }),
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
