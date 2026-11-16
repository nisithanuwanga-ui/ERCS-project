import { expect, test } from "@playwright/test";

test("login honors the server cooldown, preserves entries and waits for a manual retry", async ({
  page,
}) => {
  let submissions = 0;
  await page.route("**/api/auth/login", async (route) => {
    submissions++;
    if (submissions === 1) {
      await route.fulfill({
        status: 429,
        headers: { "Retry-After": "3", "Content-Type": "application/json" },
        body: JSON.stringify({
          error: {
            code: "AUTH_RATE_LIMITED",
            message: "Too many unsuccessful sign-in attempts.",
            retryAfterSeconds: 3,
          },
        }),
      });
    } else await route.continue();
  });
  await page.goto("/login");
  const email = page.getByLabel("Email address", { exact: true });
  const password = page.getByLabel("Password", { exact: true });
  const remember = page.getByRole("checkbox", {
    name: "Remember this device for 7 days",
  });
  await email.fill("viewer@ercs.test");
  await password.fill("E2eOnlyPassword123!");
  await remember.check();
  await page
    .getByRole("button", { name: "Sign in securely", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Try again in / }),
  ).toBeDisabled();
  await expect(page.locator("#auth-retry-status")).toContainText(
    "You can try again in",
  );
  await expect(page.getByRole("alert")).toContainText(
    "Your form details are still here.",
  );
  await expect(email).toHaveValue("viewer@ercs.test");
  await expect(password).toHaveValue("E2eOnlyPassword123!");
  await expect(remember).toBeChecked();
  await page.waitForTimeout(1100);
  expect(submissions).toBe(1);
  const retry = page.getByRole("button", {
    name: "Sign in securely",
    exact: true,
  });
  await expect(retry).toBeEnabled();
  expect(submissions).toBe(1);
  await expect(page.getByRole("alert")).not.toBeVisible();
  await retry.click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(submissions).toBe(2);
  await expect(
    page.getByRole("heading", {
      name: "Good to see you, viewer.",
      exact: true,
    }),
  ).toBeVisible();
});
