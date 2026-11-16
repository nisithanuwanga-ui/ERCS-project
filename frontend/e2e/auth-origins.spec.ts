import { expect, test } from "@playwright/test";

test("missing sign-in service does not authenticate or navigate to Dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill("integration@example.test");
  await page.locator('input[name="password"]').fill("VerificationPassword123!");
  const submission = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/csrf");
  await page.getByRole("button", { name: /sign in/i }).click();
  expect((await submission).ok()).toBe(false);
  await expect(page.getByText(/not available yet|could not complete|unable to reach/i).first()).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/authentication successful/i)).toHaveCount(0);
});

test("classic login keeps its UI and uses real failed authentication", async ({ page }) => {
  await page.goto("/login/classic");
  await page.locator("#email").fill("integration@example.test");
  await page.locator("#password").fill("VerificationPassword123!");
  const submission = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/csrf");
  await page.getByRole("button", { name: /sign in securely/i }).click();
  expect((await submission).ok()).toBe(false);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page.getByText("Authentication successful")).toHaveCount(0);
  await expect(page).toHaveURL(/\/login\/classic$/);
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/support$/);
});
