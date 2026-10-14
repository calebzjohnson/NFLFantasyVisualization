import { defineConfig, devices } from "@playwright/test"

// Smoke tests run against the real stack: Playwright starts the FastAPI
// backend and the Vite dev server (or reuses ones already running locally).
export default defineConfig({
  testDir: "e2e",
  // A cold backend downloads nflverse data on its first requests.
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  // Mobile is a Chromium phone (Pixel 5, 393px wide) so CI needs no extra
  // browser; the iPhone presets would need WebKit installed.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: [
    {
      command: "uv run uvicorn app.main:app --port 8000",
      cwd: "../backend",
      // The suite drives the whole site far faster than anyone browsing it,
      // so the per-IP limits trip on the heavy endpoints and tests fail on
      // 429s unrelated to what they check. Raised, not removed - the limiter
      // itself is covered by backend/tests/test_rate_limit.py, and this only
      // reaches the uvicorn process Playwright starts. Production reads its
      // limits from Render's own environment.
      env: {
        APP_RATE_LIMIT_DEFAULT: "2000/minute",
        APP_RATE_LIMIT_HEAVY: "2000/minute",
      },
      url: "http://localhost:8000/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
    },
  ],
})
