import { defineConfig, devices } from "@playwright/test";
const external = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { channel: process.env.PLAYWRIGHT_CHANNEL, baseURL: external ?? "http://127.0.0.1:5175", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external ? undefined : {
    command: "npm run dev -- --port 5175",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
