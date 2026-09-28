import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
test("foundation shell loads and navigation is reachable", async ({ page }) => {
  await page.goto("/app/home/oceansatarthurs");
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.getByText("MOD-02", { exact: true }).click();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Reservations day" }),
  ).toBeVisible();
});
test("foundation shell has no automated critical accessibility violation", async ({
  page,
}) => {
  await page.goto("/app/home/oceansatarthurs");
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
