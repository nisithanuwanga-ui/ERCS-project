import { expect, test } from "@playwright/test";

test("Home retains artwork, public navigation and account activation", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByText(/all example incidents, stock levels and teams below are illustrative/i)).toBeVisible();
  await expect(page.locator('img[src="/images/home/emergency-logistics.webp"]')).toBeVisible();
  await page.getByRole("link", { name: /sign in/i }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/register?token=invalid-test-token");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator('input[name="token"]')).toBeVisible();
});

for (const path of ["/dashboard","/incidents","/resources","/resource-requests","/allocations","/teams","/profile","/profile/security","/settings","/shortages","/admin/users","/admin/roles","/audit-logs"]) {
  test("preserved protected route requires real sign-in: " + path, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("h1")).toBeVisible();
  });
}

test("public navigation remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  const headings = page.locator(".landing-section-top");
  for (const section of await headings.all()) {
    const boxes = await section.locator(":scope > div").evaluateAll(elements => elements.map(element => {const r=element.getBoundingClientRect();return {x:r.x,width:r.width};}));
    expect(boxes.every(box => box.x >= 0 && box.x + box.width <= 391)).toBeTruthy();
  }
  await page.goto("/login");
  await page.locator('input[name="password"]').fill("PasswordVisibilityOnly!");
  const toggle = page.getByRole("button", { name: /show password/i });
  await toggle.click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: /hide password/i }).click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "password");
});
