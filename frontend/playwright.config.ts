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
