import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const browserErrors = new WeakMap<Page, string[]>();
const fixtureCsrf = new WeakMap<Page, string>();

test("request rejection and cancellation require confirmation and persist history", async ({
  page,
}) => {
  await login(page, "coordinator");
  const references = (
    await (await page.request.get("/api/reference-data")).json()
  ).data as { id: string; kind: string; active: boolean }[];
  const incident = await mutate(page, "/incidents", {
    title: "Request decision browser fixture",
    category_id: references.find(
      (r) => r.kind === "incident_category" && r.active === true,
    )!.id,
    description: "Incident used to verify explicit request review decisions.",
    severity: "medium",
    priority: "medium",
    location: "Decision test district",
  });
  const createRequest = () =>
    mutate(page, "/resource-requests", {
      incident_id: incident.id,
      resource_id: null,
      category_id: references.find(
        (r) => r.kind === "resource_category" && r.active === true,
      )!.id,
      quantity: 3,
      priority: "medium",
      justification:
        "Three units requested for the decision workflow browser test.",
    });
  const rejected = await createRequest();
  await page.goto(`/resource-requests/${rejected.id}`);
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Decision", exact: true })
    .selectOption("rejected");
  const reason =
    "The requested supplies are outside the approved response scope.";
  await page.getByLabel("Decision reason", { exact: true }).fill(reason);
  await page
    .getByRole("button", { name: "Save decision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Reject this request?");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Go back", exact: true })
    .click();
  expect(
    (
      await (
        await page.request.get(`/api/resource-requests/${rejected.id}`)
      ).json()
    ).data.status,
  ).toBe("under_review");
  await page
    .getByRole("button", { name: "Save decision", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".badge-rejected").first()).toBeVisible();
  const rejection = await (
    await page.request.get(`/api/resource-requests/${rejected.id}`)
  ).json();
  expect(rejection.data.status).toBe("rejected");
  expect(JSON.stringify(rejection.details)).toContain(reason);
  const cancelled = await createRequest();
  await page.goto(`/resource-requests/${cancelled.id}`);
  await page
    .getByRole("button", { name: "Cancel request", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Cancel this request?");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Go back", exact: true })
    .click();
  expect(
    (
      await (
        await page.request.get(`/api/resource-requests/${cancelled.id}`)
      ).json()
    ).data.status,
  ).toBe("pending");
  await page
    .getByRole("button", { name: "Cancel request", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".badge-cancelled").first()).toBeVisible();
  const cancellation = await (
    await page.request.get(`/api/resource-requests/${cancelled.id}`)
  ).json();
  expect(cancellation.data.status).toBe("cancelled");
  expect(JSON.stringify(cancellation.details)).toContain("cancelled");
});

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
test.beforeEach(async ({ page }) => {
  pagesUnderTest = [];
  watchBrowserErrors(page);
  await respectRateLimit(page, 150);
});
test.afterEach(async () => {
  expect(
    pagesUnderTest.flatMap((page) => browserErrors.get(page) ?? []),
    "No unhandled JavaScript exceptions or unexpected browser console errors",
  ).toEqual([]);
});

async function login(page: Page, role: string) {
  watchBrowserErrors(page);
  fixtureCsrf.delete(page);
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

async function mutate(
  page: Page,
  path: string,
  body: unknown,
  method = "POST",
) {
  let token = fixtureCsrf.get(page);
  if (!token) {
    const csrf = await page.request.get("/api/auth/csrf");
    expect(csrf.ok(), await csrf.text()).toBe(true);
    token = (await csrf.json()).data.token as string;
    fixtureCsrf.set(page, token);
  }
  const response = await page.request.fetch(`/api${path}`, {
    method,
    headers: {
      "X-CSRF-Token": token,
      Origin: "http://127.0.0.1:5175",
      ...(path === "/allocations" ? { "Idempotency-Key": randomUUID() } : {}),
    },
    data: body,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).data;
}

async function respectRateLimit(page: Page, reserve = 100) {
  // The browser suite shares one IP. Honor the production quota's actual reset
  // instead of disabling security or allowing handled 429s through the checks.
  const response = await page.request.get("/api/auth/csrf");
  expect(response.ok(), await response.text()).toBe(true);
  const quota = response.headers()["ratelimit"] ?? "";
  const remaining = quota.match(/\br=(\d+)/);
  const reset = quota.match(/\bt=(\d+)/);
  expect(remaining, `RateLimit quota header: ${quota}`).not.toBeNull();
  expect(reset, `RateLimit reset header: ${quota}`).not.toBeNull();
  if (Number(remaining![1]) >= reserve) return;
  let milliseconds = Number(reset![1]) * 1000 + 100;
  while (milliseconds > 0) {
    const duration = Math.min(milliseconds, 30000);
    await new Promise((resolve) => setTimeout(resolve, duration));
    milliseconds -= duration;
  }
  const renewed = await page.request.get("/api/auth/csrf");
  expect(renewed.ok(), await renewed.text()).toBe(true);
  const renewedQuota = renewed.headers()["ratelimit"] ?? "";
  expect(Number(renewedQuota.match(/\br=(\d+)/)?.[1])).toBeGreaterThanOrEqual(
    reserve,
  );
}

async function settleWorkspaceScreenshot(page: Page) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  await expect
    .poll(
      async () => {
        const banner = await page.getByRole("banner").boundingBox();
        return banner ? Math.abs(banner.y) < 1 : false;
      },
      { message: "Workspace screenshot starts at the top of the page" },
    )
    .toBe(true);
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
    .getByRole("link", {
      name: "Activate Account with Invitation",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Invitation token")).toBeVisible();
  await expect(page.getByLabel("Assigned role")).toHaveCount(0);
  await page.goto("/unknown-page");
  await expect(
    page.getByRole("heading", { name: "We couldn't find that page" }),
  ).toBeVisible();
});

test("workflow tour supports all six stages and keyboard selection", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#workflow");
  const tabs = page.getByRole("tablist", {
    name: "Emergency coordination workflow",
  });
  const report = tabs.getByRole("tab", { name: /Incident/ });
  const request = tabs.getByRole("tab", { name: /Request/ });
  const returned = tabs.getByRole("tab", { name: /Release/ });
  await expect(tabs.getByRole("tab")).toHaveCount(6);
  await report.focus();
  await page.keyboard.press("ArrowRight");
  await expect(request).toBeFocused();
  await expect(request).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText(
    "Operational Need Submission",
  );
  await page.keyboard.press("End");
  await expect(returned).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Field Deployment & Return",
  );
  await page.keyboard.press("Home");
  await expect(report).toBeFocused();
  await expect(report).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(returned).toBeFocused();
  await expect(tabs.getByRole("tab", { selected: true })).toHaveCount(1);
  await expect(page.getByRole("tabpanel")).toContainText("STAGE 6 OF 6");
  await expect(page.getByRole("tabpanel")).toContainText(
    "Release & Stock Restored",
  );
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
  await expect(
    page.locator(".invitation-artwork > svg.invitation-lines"),
  ).toHaveCount(1);
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
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Incidents", exact: true })
    .click();
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
  await page
    .getByLabel("Location *", { exact: true })
    .fill("Browser test district");
  await page
    .getByRole("button", { name: "Create incident", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser flood response" }),
  ).toBeVisible();
  const incidentId = page.url().split("/").at(-1)!;
  const rmContext = await browser.newContext();
  const rm = await rmContext.newPage();
  await login(rm, "resource_manager");
  await rm
    .getByRole("navigation", { name: "Workspace navigation" })
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
  const resourceId = rm.url().split("/").at(-1)!;
  await page.goto(`/resource-requests/new?incident_id=${incidentId}`);
  await expect(page.getByLabel("Linked incident")).toHaveValue(incidentId);
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
  const requestId = page.url().split("/").at(-1)!;
  await page.goto(`/resource-requests/${requestId}/edit`);
  await expect(page.getByLabel("Quantity required")).toHaveValue("8");
  await page.getByLabel("Quantity required").fill("9");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start review" }),
  ).toBeVisible();
  const savedRequest = await page.request.get(
    `/api/resource-requests/${requestId}`,
  );
  expect((await savedRequest.json()).data.quantity).toBe(9);
  await page.getByRole("button", { name: "Start review" }).click();
  await page
    .getByLabel("Decision reason")
    .fill("Approved for the district response.");
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByRole("dialog")).toContainText(/approv/i);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Allocate resources", exact: true }),
  ).toBeVisible();
  await rm
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Allocations", exact: true })
    .click();
  await rm.getByRole("link", { name: "New allocation", exact: true }).click();
  await rm.getByLabel("Approved request").selectOption(requestId);
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
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Resource inventory", exact: true })
    .click();
  const row = rm.getByRole("row").filter({ hasText: "Browser medical packs" });
  await expect(row).toContainText("18");
  await expect(row).toContainText("2");
  await rm.goto(`/resources/${resourceId}`);
  await rm
    .getByRole("button", { name: "Adjust inventory", exact: true })
    .click();
  await rm
    .getByRole("dialog")
    .getByLabel("Quantity adjustment", { exact: true })
    .fill("4");
  await rm
    .getByRole("dialog")
    .getByLabel("Adjustment reason", { exact: true })
    .fill("Four replenishment packs received at the depot.");
  await rm
    .getByRole("button", { name: "Confirm adjustment", exact: true })
    .click();
  await expect(rm.getByRole("dialog")).not.toBeVisible();
  await rm.reload();
  await expect(
    rm
      .locator("#history")
      .getByText("Four replenishment packs received at the depot.", {
        exact: false,
      })
      .first(),
  ).toBeVisible();
  const savedResource = await rm.request.get(`/api/resources/${resourceId}`);
  const inventory = (await savedResource.json()).data;
  expect(inventory.total_quantity).toBe(24);
  expect(inventory.available_quantity).toBe(22);
  expect(inventory.allocated_quantity).toBe(2);
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Audit logs", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "allocation.released", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Overview", exact: true })
    .click();
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
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Incidents", exact: true })
    .click();
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
  const token = (await (await page.request.get("/api/auth/csrf")).json()).data
    .token;
  for (const module of [
    "incidents",
    "resources",
    "resource-requests",
    "allocations",
    "teams",
  ]) {
    await page.goto(`/${module}`);
    await expect(page.locator(".management-workspace")).toBeVisible();
    await expect(
      page.locator(".management-actions").getByRole("link"),
    ).toHaveCount(0);
    await expect(
      page.locator(".module-row-actions").getByRole("link", {
        name: /^(Edit|Review request|Release resources|Update status \/ assign)$/,
      }),
    ).toHaveCount(0);
    const forbidden = await page.request.post(`/api/${module}`, {
      headers: { "X-CSRF-Token": token, Origin: "http://127.0.0.1:5175" },
      data: {},
    });
    expect(forbidden.status()).toBe(403);
  }
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
    quickActions.getByRole("link", { name: "Report incident", exact: true }),
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
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Roles & permissions", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Operational permission matrix" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
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
  await invited
    .getByRole("complementary")
    .getByRole("link", { name: "My profile", exact: true })
    .click();
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
    .getByRole("navigation", { name: "Workspace navigation" })
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
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Settings", exact: true })
    .click();
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
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Audit logs", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "reference.updated", exact: true }),
  ).toBeVisible();
  await context.close();
});
test("team creation, assignment progress, editing and operational module navigation", async ({
  page,
}) => {
  await login(page, "coordinator");
  const references = (
    await (await page.request.get("/api/reference-data")).json()
  ).data as { id: string; kind: string; active: boolean }[];
  const incident = await mutate(page, "/incidents", {
    title: "Independent team assignment incident",
    category_id: references.find(
      (r) => r.kind === "incident_category" && r.active === true,
    )!.id,
    description:
      "An independent incident fixture for team deployment and progress.",
    severity: "high",
    priority: "high",
    location: "Team workflow district",
  });
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Response teams", exact: true })
    .click();
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
    .selectOption({ value: incident.id });
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
    .getByRole("navigation", { name: "Workspace navigation" })
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

test("login typography remains readable at desktop, tablet and mobile widths", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("heading", { name: "Welcome back.", exact: true }),
    ).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", width);
    const typography = await page
      .locator(".access-form-card")
      .evaluate((card) => {
        const email = card.querySelector<HTMLInputElement>(
          'input[name="email"]',
        )!;
        const heading = card.querySelector("h1")!;
        const button = card.querySelector<HTMLButtonElement>("button.full")!;
        return {
          heading: parseFloat(getComputedStyle(heading).fontSize),
          label: parseFloat(getComputedStyle(email.closest("label")!).fontSize),
          input: parseFloat(getComputedStyle(email).fontSize),
          button: parseFloat(getComputedStyle(button).fontSize),
          inputHeight: email.getBoundingClientRect().height,
          buttonHeight: button.getBoundingClientRect().height,
          animation: getComputedStyle(card).animationName,
        };
      });
    expect(typography.heading).toBeGreaterThanOrEqual(width === 1440 ? 38 : 36);
    expect(typography.heading).toBeLessThanOrEqual(46);
    expect(typography.label).toBeGreaterThanOrEqual(16);
    expect(typography.input).toBeGreaterThanOrEqual(17);
    expect(typography.button).toBeGreaterThanOrEqual(17);
    expect(typography.inputHeight).toBeGreaterThanOrEqual(56);
    expect(typography.buttonHeight).toBeGreaterThanOrEqual(56);
    expect(typography.animation).toBe("none");
    await page.screenshot({
      path: `test-results/login-typography-${width}.png`,
      fullPage: true,
    });
  }
});

test("five distinct operational workspaces filter real records, sort, paginate and expose database summaries", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "resource_manager");
  await respectRateLimit(page);
  const references = (
    await (await page.request.get("/api/reference-data")).json()
  ).data as { id: string; kind: string; name: string; active: boolean }[];
  const category = (kind: string) =>
    references.find((r) => r.kind === kind && r.active === true)!.id;
  const resource = await mutate(page, "/resources", {
    name: "Workspace filter water kits",
    category_id: category("resource_category"),
    description: "Dedicated browser filtering fixture.",
    kind: "stock",
    total_quantity: 25,
    threshold: 3,
    status: "operational",
    location: "Filter depot",
  });
  await login(page, "coordinator");
  const incidents: { id: string; code: string }[] = [];
  for (let index = 0; index < 16; index++) {
    incidents.push(
      await mutate(page, "/incidents", {
        title: `Workspace filter incident ${String(index).padStart(2, "0")}`,
        category_id: category("incident_category"),
        description: "Dedicated emergency coordination filtering fixture.",
        severity: index === 0 ? "critical" : "low",
        priority: index === 0 ? "critical" : "medium",
        location: index === 0 ? "Filter district A" : "Filter district B",
      }),
    );
  }
  const person = (await (await page.request.get("/api/profile")).json()).data;
  const team = await mutate(page, "/teams", {
    name: "Workspace filter response unit",
    type_id: category("team_type"),
    lead_id: person.id,
    member_ids: [],
    contact: "Filter coordination desk",
    status: "operational",
  });
  await mutate(page, `/incidents/${incidents[0].id}/team-assignments`, {
    team_id: team.id,
  });
  const request = await mutate(page, "/resource-requests", {
    incident_id: incidents[0].id,
    resource_id: resource.id,
    category_id: null,
    quantity: 6,
    priority: "critical",
    justification: "Six water kits required for the filter fixture.",
  });
  await mutate(
    page,
    `/resource-requests/${request.id}/status`,
    { status: "under_review" },
    "PATCH",
  );
  await mutate(
    page,
    `/resource-requests/${request.id}/status`,
    { status: "approved" },
    "PATCH",
  );
  const allocation = await mutate(page, "/allocations", {
    request_id: request.id,
    resource_id: resource.id,
    quantity: 4,
  });

  const workspaces = [
    {
      path: "incidents",
      title: "Incidents",
      className: "incident-workspace",
      query: "Workspace filter incident",
      keys: ["total", "active", "critical", "resolved"],
      labels: ["Severity", "Priority", "Status", "Assigned team selection"],
      unique: incidents[0].code,
    },
    {
      path: "resources",
      title: "Resource inventory",
      className: "inventory-workspace",
      query: resource.name,
      keys: [
        "total_quantity",
        "available",
        "allocated",
        "maintenance",
        "low_stock",
      ],
      labels: [
        "Resource category",
        "Operational status",
        "Availability",
        "Stock level",
        "Storage location",
      ],
      unique: resource.code,
    },
    {
      path: "resource-requests",
      title: "Resource requests",
      className: "requests-workspace",
      query: request.code,
      keys: ["pending", "approved", "rejected", "partially_fulfilled"],
      labels: ["Request priority", "Request status", "Requester selection"],
      unique: request.code,
    },
    {
      path: "allocations",
      title: "Resource allocations",
      className: "allocations-workspace",
      query: allocation.code,
      keys: [
        "active",
        "completed",
        "partially_fulfilled",
        "outstanding_quantity",
      ],
      labels: [
        "Allocation status",
        "Responsible user selection",
        "Resource selection",
      ],
      unique: allocation.code,
    },
    {
      path: "teams",
      title: "Response teams",
      className: "teams-workspace",
      query: team.name,
      keys: ["total", "available", "deployed", "unavailable"],
      labels: [
        "Team type",
        "Availability",
        "Team leader selection",
        "Assigned incident selection",
      ],
      unique: team.name,
    },
  ];
  for (const workspace of workspaces) {
    await respectRateLimit(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/${workspace.path}`);
    await expect(page.locator(`.${workspace.className}`)).toBeVisible();
    await expect
      .poll(
        async () => {
          const body = await page.locator(".workspace-body").boundingBox();
          const sidebar = await page.locator(".sidebar").boundingBox();
          return !!body && !!sidebar && body.x >= sidebar.x + sidebar.width;
        },
        {
          message: "Desktop content clears the sidebar after a mobile viewport",
        },
      )
      .toBe(true);
    const desktopBody = await page.locator(".workspace-body").boundingBox();
    expect(desktopBody!.x + desktopBody!.width).toBeLessThanOrEqual(1440);
    await expect(
      page.getByRole("heading", { name: workspace.title, exact: true }),
    ).toBeVisible();
    for (const label of workspace.labels)
      await expect(
        page.getByRole(label === "Storage location" ? "textbox" : "combobox", {
          name: label,
          exact: true,
        }),
      ).toBeVisible();
    const summary = (
      await (await page.request.get(`/api/${workspace.path}/summary`)).json()
    ).data;
    for (let index = 0; index < workspace.keys.length; index++) {
      await expect(
        page.locator(".module-metric").nth(index).locator("strong"),
      ).toHaveText(
        Number(summary.counts[workspace.keys[index]]).toLocaleString(),
      );
    }
    await page
      .getByLabel(`Search ${workspace.title}`, { exact: true })
      .fill(workspace.query);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${workspace.path}\\?q=`));
    await expect(page.locator(".module-results")).toContainText(
      workspace.path === "incidents"
        ? incidents.at(-1)!.code
        : workspace.unique,
    );

    if (workspace.path === "incidents") {
      await expect(page.locator(".management-table tbody tr")).toHaveCount(15);
      await page
        .getByRole("button", { name: "Next page", exact: true })
        .click();
      await expect(page.locator(".management-table tbody tr")).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: "Previous page", exact: true }),
      ).toBeEnabled();
      await page
        .getByLabel("Rows per page", { exact: true })
        .selectOption("30");
      await expect(page.locator(".management-table tbody tr")).toHaveCount(16);
      await page
        .getByLabel("Sort records", { exact: true })
        .selectOption("oldest");
      await expect(
        page.locator(".management-table tbody tr").first(),
      ).toContainText(incidents[0].code);
      await page
        .getByRole("combobox", { name: "Severity", exact: true })
        .selectOption("critical");
      await page
        .getByRole("combobox", { name: "Priority", exact: true })
        .selectOption("critical");
      await page
        .getByRole("combobox", { name: "Status", exact: true })
        .selectOption("reported");
      await page
        .getByRole("combobox", { name: "Assigned team selection", exact: true })
        .selectOption(team.id);
      await expect(page.locator(".management-table tbody tr")).toHaveCount(1);
      await expect(page.locator(".management-table tbody tr")).toContainText(
        incidents[0].code,
      );
      await page.getByLabel("To date", { exact: true }).fill("2000-01-01");
      await expect(
        page.getByRole("heading", { name: "No matching records", exact: true }),
      ).toBeVisible();
      await page.getByLabel("To date", { exact: true }).fill("");
      await expect(page.locator(".management-table tbody tr")).toHaveCount(1);
    } else if (workspace.path === "resources") {
      await page
        .getByRole("combobox", { name: "Availability", exact: true })
        .selectOption("allocated");
      await page
        .getByRole("combobox", { name: "Operational status", exact: true })
        .selectOption("operational");
      await page
        .getByRole("combobox", { name: "Resource category", exact: true })
        .selectOption(resource.category_id);
      await expect(
        page.getByRole("progressbar", {
          name: `${resource.name} available quantity`,
          exact: true,
        }),
      ).toHaveAttribute("value", "21");
    } else if (workspace.path === "resource-requests") {
      await page
        .getByRole("combobox", { name: "Request priority", exact: true })
        .selectOption("critical");
      await page
        .getByRole("combobox", { name: "Request status", exact: true })
        .selectOption("partially_fulfilled");
      await page
        .getByRole("combobox", { name: "Requester selection", exact: true })
        .selectOption(person.id);
      await expect(page.locator(".management-table tbody tr")).toHaveCount(1);
    } else if (workspace.path === "allocations") {
      await page
        .getByRole("combobox", { name: "Allocation status", exact: true })
        .selectOption("active");
      await page
        .getByRole("combobox", { name: "Resource selection", exact: true })
        .selectOption(resource.id);
      await page
        .getByRole("combobox", {
          name: "Responsible user selection",
          exact: true,
        })
        .selectOption(person.id);
      await expect(page.locator(".management-table tbody tr")).toHaveCount(1);
    } else {
      await page
        .getByRole("combobox", { name: "Availability", exact: true })
        .selectOption("deployed");
      await page
        .getByRole("combobox", { name: "Team type", exact: true })
        .selectOption(team.type_id);
      await page
        .getByRole("combobox", { name: "Team leader selection", exact: true })
        .selectOption(person.id);
      await page
        .getByRole("combobox", {
          name: "Assigned incident selection",
          exact: true,
        })
        .selectOption(incidents[0].id);
      await expect(page.locator(".response-team-card")).toContainText(
        team.name,
      );
    }
    const filtered = await page.request.get(
      `/api/${workspace.path}${new URL(page.url()).search}`,
    );
    expect(filtered.ok()).toBe(true);
    expect((await filtered.json()).meta.total).toBe(1);
    await settleWorkspaceScreenshot(page);
    await page.screenshot({
      path: `test-results/${workspace.path}-workspace-desktop.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
    await expect(page.locator(".sidebar")).not.toBeInViewport();
    await settleWorkspaceScreenshot(page);
    await page.screenshot({
      path: `test-results/${workspace.path}-workspace-mobile.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /Reset filters/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${workspace.path}$`));
    await expect(
      page.getByLabel(`Search ${workspace.title}`, { exact: true }),
    ).toHaveValue("");
    await page
      .getByRole("button", { name: "Refresh data", exact: true })
      .click();
    await expect(page.locator(".module-results .result-total")).toHaveText(
      /^\d[\d,]*$/,
    );
  }
});
