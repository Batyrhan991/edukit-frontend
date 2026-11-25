import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 }, hasTouch: true } },
  ],
  webServer: {
    // Собранное приложение; API намеренно указывает на закрытый порт, чтобы проверить состояние ошибки.
    command: `npm run start -- --port ${port}`,
    url: `http://localhost:${port}/ru`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { EDUKIT_API_URL: process.env.E2E_API_URL ?? "http://127.0.0.1:59999" },
  },
});
