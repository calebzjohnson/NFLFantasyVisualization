// smoke.spec.ts
// End-to-end smoke tests: every page loads real data from the local backend with no errors, and search reaches a player.
import { expect, test } from "@playwright/test"

const API_ORIGIN = "http://localhost:8000"

let errors: string[] = []

// Collects uncaught exceptions, console errors, and failed API calls so any
// test fails on them, not only on what its assertions look at.
test.beforeEach(({ page }) => {
  errors = []
  page.on("pageerror", (error) => errors.push(`page error: ${error.message}`))
  page.on("console", (message) => {
    // Missing headshots and logos 404 by design (PlayerAvatar falls back to
    // initials); failed API calls are caught by the response listener below.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      errors.push(`console error: ${message.text()}`)
    }
  })
  page.on("response", (response) => {
    if (response.url().startsWith(API_ORIGIN) && !response.ok()) {
      errors.push(`${response.status()} ${response.url()}`)
    }
  })
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(API_ORIGIN)) errors.push(`request failed: ${request.url()}`)
  })
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

const PAGES = [
  { name: "home", path: "/", title: "Plot the Pigskin" },
  { name: "teams", path: "/teams", title: "Teams · Plot the Pigskin" },
  { name: "team", path: "/teams/KC", title: "Kansas City Chiefs · Plot the Pigskin" },
  { name: "players", path: "/players", title: "Players · Plot the Pigskin" },
  { name: "player", path: "/players/00-0033873", title: "Patrick Mahomes · Plot the Pigskin" },
  { name: "about", path: "/about", title: "About · Plot the Pigskin" },
]

for (const { name, path, title } of PAGES) {
  test(`${name} page loads every panel`, async ({ page }) => {
    await page.goto(path)
    // The title is set once the page has rendered (and, for team and player
    // pages, once their data arrived), so panels are loading by now.
    await expect(page).toHaveTitle(title)
    await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 60_000 })
    await expect(page.getByText(/Couldn't load/)).toHaveCount(0)
    // Nothing pushes the page wider than the screen. Wide tables are fine:
    // they scroll inside their own overflow-x-auto wrapper.
    const { scrollWidth, clientWidth } = await page
      .locator("html")
      .evaluate((html) => ({ scrollWidth: html.scrollWidth, clientWidth: html.clientWidth }))
    expect(scrollWidth, "page scrolls sideways").toBeLessThanOrEqual(clientWidth)
    // Every control is at least 24x24px, WCAG's minimum tap target. Inline text
    // links are exempt (WCAG excepts them) and so are chart markers, which
    // would overlap on crowded charts if enlarged.
    const tooSmall = await page.locator("body").evaluate((body) =>
      [...body.querySelectorAll("button, select, input, summary, [role=button]")]
        .filter((el) => !el.closest(".sr-only, svg"))
        .filter((el) => {
          const box = el.getBoundingClientRect()
          return box.width > 0 && (box.width < 24 || box.height < 24)
        })
        .map((el) => {
          const box = el.getBoundingClientRect()
          return `${el.getAttribute("aria-label") ?? el.textContent?.trim()} (${Math.round(box.width)}x${Math.round(box.height)})`
        }),
    )
    expect(tooSmall, "tap targets under 24x24px").toEqual([])
  })
}

// Overflow inside a panel doesn't widen the page (Panel clips it), so the
// page-width check above can't see these; measure them directly.
test("chart axis pickers fit on screen", async ({ page }) => {
  await page.goto("/players")
  const pickers = page.getByRole("combobox", { name: /axis/ })
  await expect(pickers).toHaveCount(2, { timeout: 60_000 })
  const screenWidth = page.viewportSize()!.width
  for (const picker of await pickers.all()) {
    const box = (await picker.boundingBox())!
    expect(box.x + box.width, "axis picker runs off screen").toBeLessThanOrEqual(screenWidth)
  }
})

for (const path of ["/players/00-0033873", "/teams/KC"]) {
  test(`radar labels fit inside the chart on ${path}`, async ({ page }) => {
    await page.goto(path)
    const label = page.locator(".recharts-polar-angle-axis-tick text").first()
    await label.waitFor({ timeout: 60_000 })
    const clipped = await label.evaluate((first) => {
      const svg = first.closest("svg")!
      const chart = svg.getBoundingClientRect()
      return [...svg.querySelectorAll(".recharts-polar-angle-axis-tick text")]
        .filter((text) => {
          const r = text.getBoundingClientRect()
          return r.left < chart.left || r.right > chart.right || r.top < chart.top || r.bottom > chart.bottom
        })
        .map((text) => text.textContent)
    })
    expect(clipped, "radar labels cut off at the chart edge").toEqual([])
  })
}

test("navbar search opens a player page", async ({ page }) => {
  await page.goto("/about")
  await page.getByRole("combobox", { name: "Search teams & players..." }).fill("Mahomes")
  await page.getByRole("option", { name: /Patrick Mahomes/ }).click()
  await expect(page).toHaveURL("/players/00-0033873")
  await expect(page).toHaveTitle("Patrick Mahomes · Plot the Pigskin")
})
