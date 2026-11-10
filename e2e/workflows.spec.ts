import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const browserErrors = new WeakMap<Page, string[]>();
let pagesUnderTest: Page[] = [];
function watchBrowserErrors(page: Page) {
  if (browserErrors.has(page)) return;
  const errors: string[] = [];
  browserErrors.set(page, errors);
  pagesUnderTest.push(page);
  page.on("pageerror", (error) =>
    errors.push(`Unhandled exception: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // Anonymous session checks and deliberately invalid credentials return 401.
    // These handled HTTP outcomes are not JavaScript application failures.
    if (/Failed to load resource:.*\b401\b/.test(message.text())) return;
    errors.push(`Console error: ${message.text()}`);
  });
}
test.beforeEach(({ page }) => {
  pagesUnderTest = [];
  watchBrowserErrors(page);
});
test.afterEach(async () => {
  expect(
    pagesUnderTest.flatMap((page) => browserErrors.get(page) ?? []),
    "No unhandled JavaScript exceptions or unexpected browser console errors",
  ).toEqual([]);
});

async function login(page: Page, role: string) {
  watchBrowserErrors(page);
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`${role}@ercs.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("E2eOnlyPassword123!");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: `Good to see you, ${role}.` }),
  ).toBeVisible();
}
test("public navigation, invitation restrictions, reduced motion and mobile layout", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Emergency Resource\s*Coordination,\s*Reimagined\./,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Emergency response coordinators reviewing logistics beside rescue vehicles and supplies in a green hill-country community",
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".cinematic-frame img")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  const publicMenu = page.getByRole("button", {
    name: "Open public navigation",
  });
  const publicNavigation = page.getByRole("navigation", {
    name: "Main navigation",
  });
  await expect(publicNavigation).not.toBeVisible();
  await publicMenu.click();
  await expect(
    page.getByRole("button", { name: "Close public navigation" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(publicNavigation).toBeVisible();
  await publicNavigation
    .getByRole("link", { name: "How it works", exact: true })
    .click();
  await expect(page).toHaveURL(/#workflow$/);
  await expect(
    page.getByRole("button", { name: "Open public navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(publicNavigation).not.toBeVisible();
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Have an invitation? Activate your account" })
    .click();
  await expect(page.getByLabel("Invitation token")).toBeVisible();
  await expect(page.getByLabel("Assigned role")).toHaveCount(0);
  await page.goto("/unknown-page");
  await expect(
    page.getByRole("heading", { name: "We couldn't find that page" }),
  ).toBeVisible();
});

test("workflow tour supports keyboard selection and exposes an honest illustrative preview", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#workflow");
  const tabs = page.getByRole("tablist", {
    name: "Emergency coordination workflow",
  });
  const report = tabs.getByRole("tab", { name: /Report/ });
  const request = tabs.getByRole("tab", { name: /Request/ });
  const returned = tabs.getByRole("tab", { name: /Return/ });
  await expect(tabs.getByRole("tab")).toHaveCount(5);
  await report.focus();
  await page.keyboard.press("ArrowRight");
  await expect(request).toBeFocused();
  await expect(request).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("Make the need clear");
  await page.keyboard.press("End");
  await expect(returned).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText("Close the loop");
  await page.keyboard.press("Home");
  await expect(report).toBeFocused();
  await expect(report).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(returned).toBeFocused();
  await expect(tabs.getByRole("tab", { selected: true })).toHaveCount(1);
  await expect(
    page.getByText("Guided example · illustrative only", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel(
      "Illustrative dashboard preview, not live operational data",
    ),
  ).toBeVisible();
});

test("Home, login and invitation activation use distinct visual identities", async ({
  page,
}) => {
  await page.goto("/");
  const homeImage = await page
    .locator(".cinematic-frame img")
    .getAttribute("src");
  expect(homeImage).toMatch(/\/images\/home\//);
  await page
    .getByRole("link", { name: "Access Operations Platform", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", {
      name: "Secure network visualization",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Abstract geographic network connecting an authorized user to incident, inventory and response team systems",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".cinematic-frame")).toHaveCount(0);
  await expect(page.locator(`img[src="${homeImage}"]`)).toHaveCount(0);
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("type", "password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  await page.screenshot({
    path: "test-results/login-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Activate your account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(
    page.getByRole("region", {
      name: "Authorized team invitation visualization",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".invitation-artwork svg")).toHaveCount(1);
  await expect(page.locator(".network-map")).toHaveCount(0);
  await expect(page.locator(`img[src="${homeImage}"]`)).toHaveCount(0);
  await expect(
    page.getByLabel("Invitation token", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/activation-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await expect(
    page.getByRole("button", { name: "Activate account", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/activation-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in securely", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
});
test("complete UI workflow: incident, inventory, request, approval, allocation, return and audit", async ({
  page,
  browser,
}) => {
  await login(page, "coordinator");
  await page.getByRole("link", { name: "Incidents", exact: true }).click();
  await page.getByRole("link", { name: "New incident", exact: true }).click();
  await page.getByLabel("Incident title").fill("Browser flood response");
  await page
    .getByRole("combobox", { name: "Category *", exact: true })
    .selectOption({ label: "Flood" });
  await page
    .getByLabel("Description *", { exact: true })
    .fill("Emergency supplies for the browser test district.");
  await page.getByLabel("Severity").selectOption("high");
  await page.getByLabel("Priority").selectOption("critical");
  await page.getByLabel("Location").fill("Browser test district");
  await page
    .getByRole("button", { name: "Create incident", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser flood response" }),
  ).toBeVisible();
  const rmContext = await browser.newContext();
  const rm = await rmContext.newPage();
  await login(rm, "resource_manager");
  await rm
    .getByRole("link", { name: "Resource inventory", exact: true })
    .click();
  await rm.getByRole("link", { name: "New resource", exact: true }).click();
  await rm.getByLabel("Resource name").fill("Browser medical packs");
  await rm
    .getByRole("combobox", { name: "Category *", exact: true })
    .selectOption({ label: "Medical supplies" });
  await rm
    .getByLabel("Description")
    .fill("Reusable medical packs for automated test.");
  await rm.getByLabel("Resource model").selectOption("stock");
  await rm.getByLabel("Total quantity").fill("20");
  await rm.getByLabel("Minimum availability threshold").fill("3");
  await rm.getByLabel("Operational status").selectOption("operational");
  await rm.getByLabel("Storage / current location").fill("Browser depot");
  await rm
    .getByRole("button", { name: "Create resource", exact: true })
    .click();
  await expect(
    rm.getByRole("heading", { name: "Browser medical packs" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Resource requests", exact: true })
    .click();
  await page.getByRole("link", { name: "New request", exact: true }).click();
  await page
    .getByLabel("Linked incident")
    .selectOption({ label: "Browser flood response" });
  await page
    .getByLabel("Specific resource")
    .selectOption({ label: "Browser medical packs · 20 available" });
  await page.getByLabel("Quantity required").fill("8");
  await page.getByLabel("Priority").selectOption("critical");
  await page
    .getByLabel("Operational justification")
    .fill("Eight medical packs are required for response.");
  await page
    .getByRole("button", { name: "Create request", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start review" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start review" }).click();
  await page
    .getByLabel("Decision reason")
    .fill("Approved for the district response.");
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(
    page.getByRole("link", { name: "Allocate resources", exact: true }),
  ).toBeVisible();
  await rm.getByRole("link", { name: "Allocations", exact: true }).click();
  await rm.getByRole("link", { name: "New allocation", exact: true }).click();
  await rm.getByLabel("Approved request").selectOption({ index: 1 });
  await rm
    .getByLabel("Eligible resource")
    .selectOption({ label: "Browser medical packs · 20 available" });
  await rm.getByLabel("Quantity to allocate").fill("5");
  await rm
    .getByRole("button", { name: "Create allocation", exact: true })
    .click();
  await expect(
    rm.getByRole("button", { name: "Return resources" }),
  ).toBeVisible();
  await rm.getByRole("button", { name: "Return resources" }).click();
  await expect(rm.getByRole("dialog")).toBeVisible();
  await rm
    .getByRole("dialog")
    .getByLabel("Quantity", { exact: true })
    .fill("3");
  await rm
    .getByLabel("Return notes")
    .fill("Three packs returned in operational condition.");
  await rm.getByRole("button", { name: "Confirm return" }).click();
  await expect(rm.getByRole("dialog")).not.toBeVisible();
  await rm
    .getByRole("link", { name: "Resource inventory", exact: true })
    .click();
  const row = rm.getByRole("row").filter({ hasText: "Browser medical packs" });
  await expect(row).toContainText("18");
  await expect(row).toContainText("2");
  await page.getByRole("link", { name: "Audit logs", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "allocation.released", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Incident trends", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Incidents", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Incidents", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  await page.screenshot({
    path: "test-results/incidents-mobile.png",
    fullPage: false,
  });
  await rmContext.close();
});
test("viewer actions and invalid credentials are handled", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("viewer@ercs.test");
  await page.getByLabel("Password", { exact: true }).fill("wrongpassword");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid credentials");
  await login(page, "viewer");
  await page.goto("/incidents/new");
  await expect(
    page.getByRole("heading", { name: "Access restricted" }),
  ).toBeVisible();
});

test("dashboard charts provide real-data tables, date filtering and role-aware quick actions", async ({
  page,
}) => {
  await login(page, "coordinator");
  await page.getByLabel("Chart date range", { exact: true }).selectOption("7");
  const chartTitles = [
    "Incident trends",
    "Resource availability",
    "Requests by priority",
    "Allocation activity",
    "Team availability",
    "Resource shortages",
  ];
  for (const title of chartTitles) {
    const chart = page.getByRole("region", { name: title, exact: true });
    await expect(
      chart.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await chart
      .getByText("View accessible data table", { exact: false })
      .click();
    const dataTable = chart.getByRole("table", {
      name: new RegExp(`^${title}:`),
    });
    await expect(dataTable).toBeVisible();
    expect(await dataTable.getByRole("columnheader").count()).toBeGreaterThan(
      1,
    );
    if (title === "Incident trends") {
      await expect(dataTable.getByRole("row")).toHaveCount(8);
    }
    await chart
      .getByText("View accessible data table", { exact: false })
      .click();
    await expect(dataTable).not.toBeVisible();
  }
  const summary = await page.request.get("/api/dashboard/summary?days=7");
  expect(summary.ok()).toBe(true);
  const operational = (await summary.json()).data;
  expect(operational.trends).toHaveLength(7);
  expect(operational.counts.active_incidents).toBeGreaterThanOrEqual(0);
  const quickActions = page.getByRole("navigation", {
    name: "Operational quick actions",
  });
  await expect(
    quickActions.getByRole("link", { name: "Report an incident", exact: true }),
  ).toBeVisible();
  await expect(
    quickActions.getByRole("link", { name: "Request resources", exact: true }),
  ).toBeVisible();
  await expect(
    quickActions.getByRole("link", { name: "Invite personnel", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/dashboard-charts-desktop.png",
    fullPage: true,
  });
});
test("administration invitation activation, profile, account security and settings", async ({
  page,
  browser,
}) => {
  await login(page, "administrator");
  await page
    .getByRole("link", { name: "Roles & permissions", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Operational permission matrix" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "User management", exact: true })
    .click();
  await page.getByRole("link", { name: "Invite user", exact: true }).click();
  await page
    .getByLabel("Email address *", { exact: true })
    .fill("browser-invited@ercs.test");
  await page
    .getByLabel("Assigned role *", { exact: true })
    .selectOption("viewer");
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Invitation created" }),
  ).toBeVisible();
  const activation = await page.getByLabel("Activation link").inputValue();
  const context = await browser.newContext();
  const invited = await context.newPage();
  watchBrowserErrors(invited);
  await invited.goto(activation);
  await invited
    .getByLabel("Full name", { exact: true })
    .fill("Browser invited user");
  await invited
    .getByLabel("Email address", { exact: true })
    .fill("browser-invited@ercs.test");
  await invited
    .getByLabel("Password", { exact: true })
    .fill("InvitedPassword123!");
  await invited
    .getByLabel("Confirm password", { exact: true })
    .fill("InvitedPassword123!");
  await invited
    .getByRole("button", { name: "Activate account", exact: true })
    .click();
  await expect(invited.getByRole("status")).toContainText(
    "Your account is ready",
  );
  await invited.getByRole("link", { name: "Continue to sign in" }).click();
  await invited
    .getByLabel("Email address", { exact: true })
    .fill("browser-invited@ercs.test");
  await invited
    .getByLabel("Password", { exact: true })
    .fill("InvitedPassword123!");
  await invited.getByRole("button", { name: "Sign in securely" }).click();
  await expect(invited).toHaveURL(/\/dashboard$/);
  await invited.getByRole("link", { name: "My profile", exact: true }).click();
  await invited.getByLabel("Display name").fill("Updated invited user");
  await invited
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(invited.getByRole("status")).toContainText("Profile updated");
  await invited.getByRole("link", { name: "Password & security" }).click();
  await invited
    .getByLabel("Current password", { exact: true })
    .fill("InvitedPassword123!");
  await invited
    .getByLabel("New password", { exact: true })
    .fill("UpdatedPassword123!");
  await invited
    .getByLabel("Confirm new password", { exact: true })
    .fill("UpdatedPassword123!");
  await invited.getByRole("button", { name: "Update password" }).click();
  await expect(invited).toHaveURL(/\/login$/);
  await page
    .getByRole("link", { name: "User management", exact: true })
    .click();
  await page
    .getByLabel("Search User management", { exact: true })
    .fill("Updated invited user");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("link", { name: "Updated invited user", exact: true })
    .click();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Role *", { exact: true })
    .selectOption("field_officer");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Field Officer", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Reference category").selectOption("incident_category");
  await page.getByLabel("Name", { exact: true }).fill("Browser test category");
  await page
    .getByRole("button", { name: "Add reference value", exact: true })
    .click();
  const referenceRow = page
    .getByRole("row")
    .filter({ hasText: "Browser test category" });
  await expect(referenceRow).toBeVisible();
  await referenceRow
    .getByRole("button", { name: "Deactivate", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Browser test category" }),
  ).toContainText("inactive");
  await page.getByRole("link", { name: "Audit logs", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "reference.updated", exact: true }),
  ).toBeVisible();
  await context.close();
});
test("team creation, assignment progress, editing and operational module navigation", async ({
  page,
}) => {
  await login(page, "coordinator");
  await page.getByRole("link", { name: "Response teams", exact: true }).click();
  await page
    .getByRole("link", { name: "New response team", exact: true })
    .click();
  await page
    .getByLabel("Team name *", { exact: true })
    .fill("Browser response team");
  await page
    .getByLabel("Team type *", { exact: true })
    .selectOption({ label: "Medical" });
  await page
    .getByLabel("Team lead *", { exact: true })
    .selectOption({ label: "field_officer" });
  await page
    .getByLabel("Authorized team contact", { exact: true })
    .fill("Test team contact");
  await page
    .getByLabel("Operational status *", { exact: true })
    .selectOption("operational");
  await page
    .getByRole("button", { name: "Create response team", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser response team", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Assign to incident")
    .selectOption({ label: "Browser flood response" });
  await page.getByRole("button", { name: "Assign team", exact: true }).click();
  await expect(page.locator(".assignment-row")).toContainText("assigned");
  for (const status of ["responding", "on_scene", "completed"]) {
    await page
      .getByRole("button", { name: "Advance status", exact: true })
      .click();
    await expect(page.locator(".assignment-row")).toContainText(
      status.replaceAll("_", " "),
    );
  }
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Team name *", { exact: true })
    .fill("Updated browser response team");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Updated browser response team",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Shortage monitoring", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Category supply & demand" }),
  ).toBeVisible();
  for (const [path, heading] of [
    ["/incidents", "Incidents"],
    ["/resources", "Resource inventory"],
    ["/resource-requests", "Resource requests"],
    ["/allocations", "Resource allocations"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
});
