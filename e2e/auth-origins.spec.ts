import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The disposable Vite listener binds IPv4 loopback. Keep the browser's real
// localhost Origin while avoiding an unrelated ::1 listener on the host.
test.use({
  launchOptions: { args: ["--host-resolver-rules=MAP localhost 127.0.0.1"] },
});

const origins = ["http://127.0.0.1:5175", "http://localhost:5175"];
const account = { email: "viewer@ercs.test", password: "E2eOnlyPassword123!" };

async function browserCsrf(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/auth/csrf", { credentials: "include" });
    const body = await response.json();
    return { status: response.status, token: body.data?.token as string };
  });
}

for (const origin of origins) {
  test(`same-origin login, session, logout and protected routes on ${new URL(origin).hostname}`, async ({
    page,
    context,
  }) => {
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));

    // A direct visit to a protected route must require authentication.
    await page.goto(`${origin}/dashboard`);
    await expect(page).toHaveURL(`${origin}/login`);
    await expect(
      page.getByRole("heading", { name: "Welcome back." }),
    ).toBeVisible();

    const anonymous = await browserCsrf(page);
    expect(anonymous.status).toBe(200);
    expect(anonymous.token).toMatch(/^[a-f0-9]{64}$/);
    const anonymousCookie = (await context.cookies(origin)).find(
      (cookie) => cookie.name === "ercs.sid",
    );
    expect(anonymousCookie).toBeDefined();
    expect(anonymousCookie!.httpOnly).toBe(true);
    expect(anonymousCookie!.sameSite).toBe("Lax");
    expect(anonymousCookie!.secure).toBe(false); // HTTP test fixture, production uses Secure.

    await page.getByLabel("Email address", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    const loginResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/login" &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Sign in securely", exact: true })
      .click();
    const authenticated = await loginResponse;
    expect(await authenticated.request().headerValue("origin")).toBe(origin);
    expect(authenticated.status(), await authenticated.text()).toBe(200);
    await expect(page).toHaveURL(`${origin}/dashboard`);
    await expect(
      page.getByRole("heading", {
        name: "Good to see you, viewer.",
        exact: true,
      }),
    ).toBeVisible();

    const authenticatedCookie = (await context.cookies(origin)).find(
      (cookie) => cookie.name === "ercs.sid",
    );
    expect(authenticatedCookie!.value !== anonymousCookie!.value).toBe(true);
    expect(authenticatedCookie!.domain).toBe(new URL(origin).hostname);
    const otherOrigin = origins.find((value) => value !== origin)!;
    expect(
      (await context.cookies(otherOrigin)).some(
        (cookie) => cookie.name === "ercs.sid",
      ),
    ).toBe(false);

    await page.reload();
    await expect(page).toHaveURL(`${origin}/dashboard`);
    await expect(
      page.getByRole("heading", {
        name: "Good to see you, viewer.",
        exact: true,
      }),
    ).toBeVisible();
    const session = await page.evaluate(async () => {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      const body = await response.json();
      return { status: response.status, role: body.data?.role };
    });
    expect(session).toEqual({ status: 200, role: "viewer" });
    const currentCsrf = await browserCsrf(page);
    expect(currentCsrf.token !== anonymous.token).toBe(true);

    await page.goto(`${origin}/incidents`);
    await expect(
      page.getByRole("heading", { name: "Incidents", exact: true }),
    ).toBeVisible();
    const logoutResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/logout" &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    const loggedOut = await logoutResponse;
    expect(loggedOut.status()).toBe(200);
    expect(await loggedOut.request().headerValue("origin")).toBe(origin);
    await expect(page).toHaveURL(`${origin}/login`);
    await expect
      .poll(async () =>
        (await context.cookies(origin)).some(
          (cookie) =>
            cookie.name === "ercs.sid" &&
            cookie.value === authenticatedCookie!.value,
        ),
      )
      .toBe(false);

    const protectedStatus = await page.evaluate(
      async () =>
        (await fetch("/api/incidents", { credentials: "include" })).status,
    );
    expect(protectedStatus).toBe(401);
    await page.goto(`${origin}/dashboard`);
    await expect(page).toHaveURL(`${origin}/login`);
    expect(browserErrors).toEqual([]);
  });
}

test("the proxy preserves rejection of untrusted origins and missing or invalid CSRF tokens", async ({
  page,
}) => {
  const origin = origins[0];
  await page.goto(`${origin}/login`);
  const csrf = await browserCsrf(page);
  expect(csrf.status).toBe(200);

  for (const rejectedOrigin of [
    "https://attacker.example",
    "http://localhost:5173", // A different port is a different origin.
    "https://127.0.0.1:5175",
    "http://localhost.attacker.example:5175",
    "http://127.0.0.1:5175.attacker.example",
    "null",
    undefined,
  ]) {
    const response = await page.request.post(`${origin}/api/auth/login`, {
      headers: {
        "X-CSRF-Token": csrf.token,
        ...(rejectedOrigin === undefined ? {} : { Origin: rejectedOrigin }),
      },
      data: account,
    });
    expect(response.status(), `Origin ${rejectedOrigin ?? "<missing>"}`).toBe(
      403,
    );
    expect((await response.json()).error).toMatchObject({
      code: "CSRF",
      message: "This request origin is not allowed.",
    });
  }

  for (const token of [undefined, "incorrect-csrf-token"]) {
    const response = await page.request.post(`${origin}/api/auth/login`, {
      headers: { Origin: origin, ...(token ? { "X-CSRF-Token": token } : {}) },
      data: account,
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error.message).toContain("security token");
  }
  expect((await page.request.get(`${origin}/api/auth/me`)).status()).toBe(401);
});
