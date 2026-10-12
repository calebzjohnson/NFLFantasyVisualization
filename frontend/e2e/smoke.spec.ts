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

test("navbar fits its layout for the screen size", async ({ page }) => {
  await page.goto("/about")
  const logo = (await page.getByRole("link", { name: "Plot the Pigskin" }).boundingBox())!
  const search = page.getByRole("combobox", { name: "Search teams & players..." })
  const searchBox = (await search.boundingBox())!
  const tab = (await page.getByRole("link", { name: "Home" }).boundingBox())!
  const middle = (box: { y: number; height: number }) => box.y + box.height / 2
  const besideLogo = (box: { y: number; height: number }) => Math.abs(middle(box) - middle(logo)) < logo.height / 2

  expect(besideLogo(searchBox), "search sits beside the logo").toBe(true)
  expect(searchBox.x + searchBox.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  if (page.viewportSize()!.width >= 1024) {
    expect(besideLogo(tab), "desktop keeps logo, tabs, and search on one row").toBe(true)
  } else {
    expect(tab.y, "tabs drop below the logo and search").toBeGreaterThan(searchBox.y + searchBox.height)
    // A narrow search box still gets a readable results list: logo edge to search edge.
    await search.fill("Ma")
    const list = (await page.getByRole("listbox").boundingBox())!
    expect(Math.round(list.x)).toBe(Math.round(logo.x))
    expect(Math.round(list.x + list.width)).toBe(Math.round(searchBox.x + searchBox.width))
  }
})

// A mouse hovers a line for a floating card and clicks to open it. A finger
// can't hover: a tap shows the line's numbers in a box below the chart (so the
// chart stays clear), and the box's button or a second tap opens the page.
test("trending chart lines preview then open, by hover or by tap", async ({ page, hasTouch }) => {
  const chart = page.locator("section", { has: page.getByRole("heading", { name: "Trending Players" }) })
  const figure = chart.getByRole("figure")
  // A line's midpoint, and which player the browser actually hits there (a
  // neighboring line can run on top).
  async function linePoint() {
    await page.goto("/players")
    const hitLine = chart.locator('.recharts-line-curve[stroke="transparent"]').nth(2)
    await hitLine.waitFor({ timeout: 60_000 })
    await chart.scrollIntoViewIfNeeded()
    return hitLine.evaluate((path) => {
      const pt = path.getPointAtLength(path.getTotalLength() / 2)
      const m = path.getScreenCTM()!
      const screen = { x: pt.x * m.a + m.e, y: pt.y * m.d + m.f }
      return { ...screen, id: path.ownerDocument.elementFromPoint(screen.x, screen.y)!.getAttribute("name") }
    })
  }

  const { x, y, id } = await linePoint()
  expect(id, "a trend line under the test point").toBeTruthy()

  if (!hasTouch) {
    await page.mouse.move(x, y)
    await expect(chart.getByText("Slope")).toBeVisible()
    await page.mouse.click(x, y)
    await expect(page).toHaveURL(`/players/${id}`)
    return
  }

  await expect(chart.getByText("Tap a line to see that player's numbers.")).toBeVisible()
  await page.touchscreen.tap(x, y)
  const open = chart.getByRole("button", { name: /^View .+ →$/ })
  await expect(open).toBeVisible()
  await expect(page).toHaveURL("/players")
  // The details sit below the chart, not over it.
  const chartBox = (await figure.boundingBox())!
  expect((await open.boundingBox())!.y).toBeGreaterThanOrEqual(chartBox.y + chartBox.height)
  await open.tap()
  await expect(page).toHaveURL(`/players/${id}`)

  // Tapping the same line a second time opens it too.
  const again = await linePoint()
  await page.touchscreen.tap(again.x, again.y)
  await expect(open).toBeVisible()
  await page.touchscreen.tap(again.x, again.y)
  await expect(page).toHaveURL(`/players/${again.id}`)
})

test("navbar search opens a player page", async ({ page }) => {
  await page.goto("/about")
  await page.getByRole("combobox", { name: "Search teams & players..." }).fill("Mahomes")
  await page.getByRole("option", { name: /Patrick Mahomes/ }).click()
  await expect(page).toHaveURL("/players/00-0033873")
  await expect(page).toHaveTitle("Patrick Mahomes · Plot the Pigskin")
})
