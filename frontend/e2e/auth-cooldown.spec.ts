import { expect, test } from "@playwright/test";

test("activation reports server failure without claiming an account was activated", async ({ page }) => {
  await page.goto("/register?token=invalid-test-token");
  await page.locator('input[name="name"]').fill("Integration Verification");
  await page.locator('input[name="email"]').fill("integration@example.test");
  await page.locator('input[name="confirm"]').fill("VerificationPassword123!");
  await page.locator('input[name="password"]').fill("VerificationPassword123!");
  const submission = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/csrf");
  await page.getByRole("button", { name: /activate/i }).click();
  expect((await submission).ok()).toBe(false);
  await expect(page.getByText(/not available yet|could not complete|unable to reach/i).first()).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
});

for (const kind of ["privacy","security","support"]) {
  test("classic footer " + kind + " link has a useful destination", async ({ page }) => {
    await page.goto("/login/classic");
    await page.getByRole("link", { name: new RegExp("^" + kind + "$", "i") }).click();
    await expect(page).toHaveURL(new RegExp("/" + kind + "$"));
    await expect(page.getByRole("heading", { name: new RegExp("^" + kind + "$", "i") })).toBeVisible();
  });
}
