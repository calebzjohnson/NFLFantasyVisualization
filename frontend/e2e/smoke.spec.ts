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
  {
    name: "team depth chart",
    path: "/teams/KC?tab=depth-chart",
    title: "Kansas City Chiefs · Plot the Pigskin",
  },
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
  })
}

test("navbar search opens a player page", async ({ page }) => {
  await page.goto("/about")
  await page.getByRole("combobox", { name: "Search teams & players..." }).fill("Mahomes")
  await page.getByRole("option", { name: /Patrick Mahomes/ }).click()
  await expect(page).toHaveURL("/players/00-0033873")
  await expect(page).toHaveTitle("Patrick Mahomes · Plot the Pigskin")
})

test("team page tabs swap the body and survive a reload", async ({ page }) => {
  await page.goto("/teams/KC")
  await expect(page.getByRole("heading", { name: "Game Log" })).toBeVisible()

  await page.getByRole("button", { name: "Depth Chart" }).click()
  await expect(page).toHaveURL("/teams/KC?tab=depth-chart")
  await expect(page.getByRole("heading", { name: "Game Log" })).toHaveCount(0)

  // The defense is headed by the team's real scheme, the offense by its
  // personnel grouping - both come from nflverse rather than being hardcoded.
  await expect(page.getByRole("heading", { name: /^Base [34]-[34] D$/ })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Special Teams" })).toBeVisible()

  await page.reload()
  await expect(page.getByRole("button", { name: "Depth Chart" })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(page.getByRole("heading", { name: "Game Log" })).toHaveCount(0)
})

test("depth chart lists a quarterback room in depth order", async ({ page }) => {
  await page.goto("/teams/KC?tab=depth-chart")
  const offense = page.getByRole("table").first()
  const quarterbacks = offense.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "QB" }) })

  await expect(quarterbacks.getByRole("link").first()).toHaveAttribute("href", /^\/players\//)
  await expect(quarterbacks.getByRole("link")).not.toHaveCount(0)
})

test("offense is ordered backfield, receivers, then the line left to right", async ({ page }) => {
  await page.goto("/teams/KC?tab=depth-chart")
  const offense = page.getByRole("table").first()
  // allTextContents() reads once with no auto-retry, so wait for the table to
  // have rendered before snapshotting it.
  await expect(offense.getByRole("rowheader").first()).toHaveText("QB")
  const positions = await offense.getByRole("rowheader").allTextContents()

  // indexOf returns -1 when a row is missing, which would make the ordering
  // comparisons below pass vacuously - so check they're all there first.
  for (const position of ["QB", "RB", "WR", "TE", "LT", "LG", "C", "RG", "RT"]) {
    expect(positions, `missing ${position}`).toContain(position)
  }

  // nflverse's own pos_slot would interleave the line with the receivers.
  expect(positions[0]).toBe("QB")
  expect(positions.indexOf("RB")).toBeLessThan(positions.indexOf("WR"))
  expect(positions.indexOf("WR")).toBeLessThan(positions.indexOf("TE"))
  expect(positions.indexOf("TE")).toBeLessThan(positions.indexOf("LT"))
  for (const [left, right] of [["LT", "LG"], ["LG", "C"], ["C", "RG"], ["RG", "RT"]]) {
    expect(positions.indexOf(left)).toBeLessThan(positions.indexOf(right))
  }
})

test("the offense is headed by its personnel grouping", async ({ page }) => {
  await page.goto("/teams/KC?tab=depth-chart")
  await expect(page.getByRole("heading", { name: /^\d+WR \d+TE$/ })).toBeVisible()
})

test("unavailable players are flagged in the depth chart itself", async ({ page }) => {
  await page.goto("/teams/KC?tab=depth-chart")
  const offense = page.getByRole("table").first()

  // Every team carries several reserve players in its listed depth.
  await expect(offense.getByTitle(/Injury Reserve|Physically Unable/).first()).toBeVisible()
})

test("availability names a cause, participation, and how stale the report is", async ({ page }) => {
  await page.goto("/teams/KC?tab=depth-chart")
  const report = page.getByRole("heading", { name: "Availability" }).locator("xpath=ancestor::section")

  await expect(report.getByRole("columnheader", { name: "Injury" })).toBeVisible()
  await expect(report.getByRole("columnheader", { name: "Practice" })).toBeVisible()
  await expect(report.getByRole("columnheader", { name: "Last Report" })).toBeVisible()
  await expect(report.getByRole("row")).not.toHaveCount(1)
  await expect(report.getByText(/doesn't cover most players placed on reserve/)).toBeVisible()
})

test("an unrecognised tab falls back to Overview", async ({ page }) => {
  await page.goto("/teams/KC?tab=nonsense")

  await expect(page.getByRole("heading", { name: "Game Log" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-pressed", "true")
})

test("back from a tab leaves the team page rather than stepping through tabs", async ({ page }) => {
  await page.goto("/teams")
  await page.getByRole("link", { name: /Chiefs/ }).first().click()
  await expect(page).toHaveURL("/teams/KC")

  await page.getByRole("button", { name: "Depth Chart" }).click()
  await expect(page).toHaveURL("/teams/KC?tab=depth-chart")

  await page.goBack()
  await expect(page).toHaveURL("/teams")
})
