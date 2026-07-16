import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test("unauthenticated /account redirects to login", async ({ page }) => {
  await page.goto("/en/account");

  await expect(page).toHaveURL(/\/en\/login/);
  await expect(page.getByTestId("login")).toBeVisible();
});

test("login page has no accessibility violations", async ({ page }) => {
  await page.goto("/en/login");
  await expect(page.getByTestId("login")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
