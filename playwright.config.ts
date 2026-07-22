import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env["ANKUR_E2E_BASE_URL"];

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  ...(externalBaseUrl === undefined ? {
    webServer: {
      command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100/api/health",
      reuseExistingServer: true,
      stdout: "ignore" as const,
      stderr: "ignore" as const,
      timeout: 120_000,
    },
  } : {}),
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"], channel: "chrome" } },
  ],
});
