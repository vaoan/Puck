import AxeBuilder from "@axe-core/playwright";

import { test, expect } from "../fixtures/auth.fixture";

test("authenticated user edits and persists their display name", async ({
  page,
  authenticatedPage,
}) => {
  expect(authenticatedPage.userId).toBeTruthy();
  await page.goto("/en/account");
  await expect(page.getByTestId("account")).toBeVisible();

  await page.getByTestId("profile-display-name").fill("E2E Organizer");

  // Wait for the actual PATCH to user_profiles to land before reloading.
  const saved = page.waitForResponse(
    (res) =>
      res.url().includes("/rest/v1/user_profiles") &&
      res.request().method() === "PATCH" &&
      res.ok(),
  );
  await page.getByTestId("profile-save").click();
  await saved;

  // Reload: the value must come back from the DB, proving persistence.
  await page.reload();
  await expect(page.getByTestId("profile-display-name")).toHaveValue(
    "E2E Organizer",
  );
});

test("account page has no accessibility violations", async ({
  page,
  authenticatedPage,
}) => {
  expect(authenticatedPage.userId).toBeTruthy();
  await page.goto("/en/account");
  await expect(page.getByTestId("account")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
