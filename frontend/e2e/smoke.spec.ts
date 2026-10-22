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
    name: "team playmaking",
    path: "/teams/KC?tab=playmaking",
    title: "Kansas City Chiefs · Plot the Pigskin",
  },
  {
    name: "team depth chart",
    path: "/teams/KC?tab=depth-chart",
    title: "Kansas City Chiefs · Plot the Pigskin",
  },
  { name: "players", path: "/players", title: "Players · Plot the Pigskin" },
  { name: "player", path: "/players/00-0033873", title: "Patrick Mahomes · Plot the Pigskin" },
  { name: "matchups", path: "/matchups", title: "Matchups · Plot the Pigskin" },
  { name: "about", path: "/about", title: "About · Plot the Pigskin" },
  { name: "create", path: "/create", title: "Create · Plot the Pigskin" },
  {
    name: "create player bars",
    path: "/create?kind=players&type=bar&ids=00-0033873&stats=passing_yards,passing_tds",
    title: "Create · Plot the Pigskin",
  },
  { name: "create team lines", path: "/create?kind=teams&type=line&ids=KC,BUF", title: "Create · Plot the Pigskin" },
  {
    name: "create player scatter",
    path: "/create?kind=players&type=scatter&ids=00-0033873,00-0034796&stats=passing_yards,epa_per_dropback",
    title: "Create · Plot the Pigskin",
  },
  { name: "create team beeswarm", path: "/create?kind=teams&type=beeswarm&ids=KC,BUF", title: "Create · Plot the Pigskin" },
  {
    name: "create player radar",
    path: "/create?kind=players&type=radar&ids=00-0033873,00-0034796",
    title: "Create · Plot the Pigskin",
  },
  { name: "create team radar", path: "/create?kind=teams&type=radar&ids=KC,BUF,DET", title: "Create · Plot the Pigskin" },
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
      // Rounded, because a dispatched mouse event lands on a whole pixel:
      // two lines can run less than a pixel apart, so the player at the
      // fractional point isn't always the one the click will open.
      const screen = { x: Math.round(pt.x * m.a + m.e), y: Math.round(pt.y * m.d + m.f) }
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

// Team Efficiency follows the same pattern: hover/click with a mouse; on a
// touchscreen a tap shows the mark's numbers below the chart, and the box's
// button or a second tap opens its page.
test("Team Efficiency marks preview then open, by hover or by tap", async ({ page, hasTouch }) => {
  const path = "/"
  const opened = /\/teams\/[A-Z]+$/
  const chart = page.locator("section", { has: page.getByRole("heading", { name: "Team Efficiency" }) }).first()
  // Marks are tapped/clicked through the locator, which re-finds the node if
  // recharts re-renders it; force, because neighboring marks overlap and
  // whichever is on top at that point is the one the user would hit.
  const mark = chart.locator("svg [role=button]").nth(5)
  async function visit() {
    await page.goto(path)
    await mark.waitFor({ timeout: 60_000 })
    // Panels (and their images) still loading would shift the layout, and
    // the chart re-measures itself - its marks briefly have no size.
    await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 60_000 })
    await page.waitForLoadState("networkidle")
    await chart.scrollIntoViewIfNeeded()
  }

  await visit()
  if (!hasTouch) {
    await mark.hover({ force: true })
    await expect(chart.locator("[data-hover-card]")).toBeVisible()
    await mark.click({ force: true })
    await expect(page).toHaveURL(opened)
    return
  }

  await expect(chart.getByText("Tap a logo to see that team's numbers.")).toBeVisible()
  await mark.tap({ force: true })
  const open = chart.getByRole("button", { name: /^View .+ →$/ })
  await expect(open).toBeVisible()
  await expect(page).toHaveURL(path)
  const chartBox = (await chart.getByRole("figure").boundingBox())!
  expect((await open.boundingBox())!.y, "details sit below the chart").toBeGreaterThanOrEqual(chartBox.y + chartBox.height)
  await open.tap()
  await expect(page).toHaveURL(opened)

  await visit()
  await mark.tap({ force: true })
  await expect(open).toBeVisible()
  await mark.tap({ force: true })
  await expect(page).toHaveURL(opened)
})

// Compare Teams/Players: a click or tap highlights a mark (another click moves
// the highlight, the chip's x clears it), and a second click on the
// highlighted mark opens its page. On a touchscreen the highlighted mark's
// numbers show below the chart too, with a button to open it.
const COMPARE_SCATTERS = [
  { path: "/teams", heading: "Compare Teams", opened: /\/teams\/[A-Z]+$/ },
  { path: "/players", heading: "Compare Players", opened: /\/players\/[^/]+$/ },
]

for (const { path, heading, opened } of COMPARE_SCATTERS) {
  test(`${heading} marks highlight, then open, by click or by tap`, async ({ page, hasTouch }) => {
    const chart = page.locator("section", { has: page.getByRole("heading", { name: heading }) }).first()
    // Unhighlighted marks are named "Highlight ..."; the highlighted one,
    // which moves to the end of the draw order, "View ... page".
    const mark = chart.locator('svg [role=button][aria-label^="Highlight"]')
    const highlighted = chart.locator('svg [role=button][aria-label^="View"]')
    const chip = chart.getByRole("button", { name: /^Stop highlighting / })
    async function visit() {
      await page.goto(path)
      await mark.first().waitFor({ timeout: 60_000 })
      await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 60_000 })
      await page.waitForLoadState("networkidle")
      await chart.scrollIntoViewIfNeeded()
    }
    const press = (target: import("@playwright/test").Locator) =>
      hasTouch ? target.tap({ force: true }) : target.click({ force: true })

    await visit()
    if (!hasTouch) {
      await mark.nth(5).hover({ force: true })
      await expect(chart.locator("[data-hover-card]")).toBeVisible()
    }
    await press(mark.nth(5))
    await expect(highlighted).toHaveCount(1)
    await expect(chip).toBeVisible()
    await expect(page).toHaveURL(path)
    const first = await chip.textContent()

    // Another mark takes the highlight over.
    await press(mark.nth(20))
    await expect(highlighted).toHaveCount(1)
    await expect(chip).not.toHaveText(first!)
    await expect(page).toHaveURL(path)

    // The chip clears it.
    await chip.click()
    await expect(highlighted).toHaveCount(0)

    await press(mark.nth(5))
    if (hasTouch) {
      const open = chart.getByRole("button", { name: /^View .+ →$/ })
      await expect(open).toBeVisible()
      const chartBox = (await chart.getByRole("figure").boundingBox())!
      expect((await open.boundingBox())!.y, "details sit below the chart").toBeGreaterThanOrEqual(chartBox.y + chartBox.height)
    }
    await press(highlighted)
    await expect(page).toHaveURL(opened)
  })
}

// On the Create page's scatter a mark is a pick toggle, not a link: a click or
// tap adds it to the picks, one on a pick removes it, and nothing navigates.
test("Create scatter marks add and remove picks, by click or by tap", async ({ page, hasTouch }) => {
  const path = "/create?kind=teams&type=scatter&ids=KC"
  await page.goto(path)
  const chart = page.locator("section", { has: page.getByRole("heading", { name: /vs\./ }) })
  const add = chart.locator('svg [role=button][aria-label^="Add"]')
  const remove = chart.locator('svg [role=button][aria-label^="Remove"]')
  await add.first().waitFor({ timeout: 60_000 })
  await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 60_000 })
  await chart.scrollIntoViewIfNeeded()
  const press = (target: import("@playwright/test").Locator) =>
    hasTouch ? target.tap({ force: true }) : target.click({ force: true })

  // On a touchscreen the tapped team also fills the details box; a mouse has the hover card instead.
  const status = (text: string | RegExp) => chart.getByText(text)

  await expect(remove).toHaveCount(1)
  await press(add.nth(3))
  await expect(remove).toHaveCount(2)
  await expect(chart.getByRole("list", { name: "Picks" }).getByRole("listitem")).toHaveCount(2)
  if (hasTouch) await expect(status("One of your picks. Tap again to remove.")).toBeVisible()
  else await expect(status(/One of your picks/)).toHaveCount(0)

  await press(chart.locator('[aria-label="Remove Kansas City Chiefs from your picks"]'))
  await expect(remove).toHaveCount(1)
  await expect(page).toHaveURL(/\/create\?kind=teams&type=scatter&ids=[A-Z]+$/)
  expect(page.url()).not.toContain("KC")

  if (hasTouch) {
    // The removed team stays in the box, a tap away from coming back, with a way to its page.
    await expect(status("Not in your picks. Tap again to add.")).toBeVisible()
    await chart.getByRole("button", { name: "View Kansas City Chiefs →" }).click()
    await expect(page).toHaveURL("/teams/KC")
  }
})

// Adding a player loads their bio; the chart must stay up meanwhile, or the
// tapped player drops out of the details box.
test("a Create scatter tap on a player shows them in the details box", async ({ page, hasTouch }) => {
  test.skip(!hasTouch, "the details box is touch-only")
  await page.goto("/create?kind=players&type=scatter&ids=00-0033873&stats=passing_yards,epa_per_dropback")
  const chart = page.locator("section", { has: page.getByRole("heading", { name: /vs\./ }) })
  const add = chart.locator('svg [role=button][aria-label^="Add"]')
  await add.first().waitFor({ timeout: 60_000 })
  await chart.scrollIntoViewIfNeeded()

  await add.nth(10).tap({ force: true })
  await expect(chart.getByText("One of your picks. Tap again to remove.")).toBeVisible()
  await expect(chart.getByRole("button", { name: /^View .+ →$/ })).toBeVisible()
})

test("a Create scatter tap past five picks says why it didn't add", async ({ page, hasTouch }) => {
  test.skip(!hasTouch, "the details box is touch-only")
  await page.goto("/create?kind=teams&type=scatter&ids=KC,BUF,DET,PHI,SF")
  const chart = page.locator("section", { has: page.getByRole("heading", { name: /vs\./ }) })
  const add = chart.locator('svg [role=button][aria-label^="Add"]')
  await add.first().waitFor({ timeout: 60_000 })
  await chart.scrollIntoViewIfNeeded()

  await add.first().tap({ force: true })
  await expect(chart.getByText(/^You have 5 picks\. Remove one to add .+\.$/)).toBeVisible()
  await expect(chart.locator('svg [role=button][aria-label^="Remove"]')).toHaveCount(5)
})

// Pointing at (or tapping) the radar anywhere picks the nearest spoke by angle,
// and lists every pick's numbers on it: a hover card, or the box below on a touchscreen.
test("Create radar spokes show every pick's numbers, by hover or by tap", async ({ page, hasTouch }) => {
  await page.goto("/create?kind=teams&type=radar&ids=KC,BUF&stats=points,points_allowed,yards,turnovers")
  const chart = page.locator("section", { has: page.getByRole("heading", { name: "Radar Comparison" }) })
  const svg = chart.locator("svg.recharts-surface")
  await svg.waitFor({ timeout: 60_000 })
  await svg.scrollIntoViewIfNeeded()
  const box = (await svg.boundingBox())!
  // Straight up from the center: the first spoke, Points / Game.
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2 - 60]

  if (hasTouch) {
    await expect(chart.getByText("Tap a stat to see every pick's numbers on it.", { exact: true })).toBeVisible()
    await page.touchscreen.tap(x, y)
    const details = chart.locator("[aria-live]")
    await expect(details).toContainText("Points / Game")
    await expect(details).toContainText("Kansas City Chiefs")
    await expect(details).toContainText("Buffalo Bills")
  } else {
    await page.mouse.move(x, y)
    const card = chart.locator("[data-hover-card]")
    await expect(card).toContainText("Points / Game")
    await expect(card).toContainText("Buffalo Bills")
    // In the panel but well away from the radar (its bottom-left corner): no card.
    await page.mouse.move(box.x + 10, box.y + box.height - 10)
    await expect(card).toHaveCount(0)
  }
})

// Every Create chart's whole panel fits on one desktop screen (FIT_SCREEN caps
// the charts sized by their width).
test("each Create chart panel fits on one desktop screen", async ({ page, hasTouch }) => {
  test.skip(hasTouch, "a desktop layout check")
  for (const type of ["bar", "line", "scatter", "beeswarm", "radar"]) {
    await page.goto(`/create?kind=players&type=${type}&ids=00-0033873,00-0034796&stats=passing_yards,passing_tds,completions,attempts`)
    await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 60_000 })
    const panel = page.locator("section").nth(1)
    await expect(panel.locator("h2")).toBeVisible()
    const height = (await panel.boundingBox())!.height
    expect(height, `${type} panel`).toBeLessThanOrEqual(page.viewportSize()!.height)
  }
})

// With a mouse, the hover card follows the mark whose center is nearest the
// pointer (within 20px, chartMarks.REACH), not whichever mark's shape is under it: marks overlap,
// and the one drawn on top is often not the closest.
const NEAREST_HOVER = [
  { path: "/", heading: "Team Efficiency" },
  { path: "/teams", heading: "Compare Teams" },
  { path: "/players", heading: "Compare Players" },
  { path: "/teams", heading: "League Comparison" },
]

for (const { path, heading } of NEAREST_HOVER) {
  test(`${heading} on ${path} hovers the nearest mark`, async ({ page, hasTouch }) => {
    test.skip(hasTouch, "a touchscreen has no hover")
    await page.goto(path)
    const chart = page.locator("section", { has: page.getByRole("heading", { name: heading }) }).first()
    await chart.locator("[data-tap-key]").first().waitFor({ timeout: 60_000 })
    await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 60_000 })
    await page.waitForLoadState("networkidle")
    await chart.scrollIntoViewIfNeeded()

    // A point near a named mark where the browser's own hit test disagrees:
    // a different mark's shape is under it, or none is.
    const probe = await chart.evaluate((section) => {
      const marks = [...section.querySelectorAll("[data-chart-marks] [data-tap-key]")].map((el) => {
        const box = el.getBoundingClientRect()
        // The mark's name, from its button label ("Highlight X", "View the X team page", ...).
        const label = (el.matches("[role=button]") ? el : el.querySelector("[role=button]"))?.getAttribute("aria-label")
        const name = label?.replace(/^(Highlight|View) (the )?/, "").replace(/('s (player|team) page| team page)$/, "") ?? null
        return { el, name, x: box.x + box.width / 2, y: box.y + box.height / 2 }
      })
      for (const mark of marks) {
        for (const [dx, dy] of [[14, 0], [-14, 0], [0, 14], [0, -14], [10, 10], [-10, -10], [10, -10], [-10, 10]]) {
          const x = mark.x + dx
          const y = mark.y + dy
          const nearest = marks.reduce((a, b) => (Math.hypot(b.x - x, b.y - y) <= Math.hypot(a.x - x, a.y - y) ? b : a))
          if (!nearest.name || Math.hypot(nearest.x - x, nearest.y - y) > 20) continue
          const under = section.ownerDocument.elementFromPoint(x, y)?.closest("[data-tap-key]")
          if (under !== nearest.el) return { x, y, name: nearest.name }
        }
      }
      return null
    })
    expect(probe, "a point where the mark under the pointer isn't the nearest").toBeTruthy()

    await page.mouse.move(probe!.x, probe!.y)
    await expect(chart.locator("[data-hover-card]")).toContainText(probe!.name)
  })
}

// The player page's weekly usage chart: stacked bars (WR target share) or
// lines with dots (RB touch share). Same pattern: hover/click with a mouse; a
// tap shows the numbers below the chart, and the button or a second tap opens
// the teammate's page.
const USAGE_CHARTS = [
  { name: "bars", playerId: "00-0030279", prompt: "Tap a bar to see that week's numbers." },
  { name: "lines", playerId: "00-0032764", prompt: "Tap a dot or line to see the numbers." },
]

for (const { name, playerId, prompt } of USAGE_CHARTS) {
  test(`usage chart ${name} preview then open a teammate, by hover or by tap`, async ({ page, hasTouch }) => {
    const path = `/players/${playerId}`
    const chart = page.locator("section", { has: page.getByRole("button", { name: "Weekly" }) }).first()
    // A teammate's mark (not this player's own, not "Other"), its center, and
    // which teammate the browser actually hits there.
    async function teammateMark() {
      await page.goto(path)
      await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 60_000 })
      await chart.scrollIntoViewIfNeeded()
      return chart.evaluate(
        (section, { kind, self }) => {
          const marks =
            kind === "bars"
              ? [...section.querySelectorAll('[data-tap-key^="bar:"]')].map((el) => ({ el, key: el.getAttribute("data-tap-key")! }))
              : [...section.querySelectorAll('.recharts-line-curve[name^="line:"]')].map((el) => ({ el, key: el.getAttribute("name")! }))
          for (const { el, key } of marks) {
            const player = kind === "bars" ? key.split("|")[1] : key.slice("line:".length)
            if (player === self || player === "__other__") continue
            // A bar's center; for a line, points along it until one isn't
            // under a dot or another line.
            const r = el.getBoundingClientRect()
            const points =
              kind === "bars"
                ? [{ x: r.x + r.width / 2, y: r.y + r.height / 2 }]
                : [0.5, 0.35, 0.65, 0.2, 0.8].map((t) => {
                    const pt = el.getPointAtLength(el.getTotalLength() * t)
                    const m = el.getScreenCTM()!
                    return { x: pt.x * m.a + m.e, y: pt.y * m.d + m.f }
                  })
            for (const point of points) {
              const hit = el.ownerDocument.elementFromPoint(point.x, point.y)
              const hitKey = hit?.closest("[data-tap-key]")?.getAttribute("data-tap-key") ?? hit?.getAttribute("name")
              if (hitKey === key) return { ...point, player }
            }
          }
          return null
        },
        { kind: name, self: playerId },
      )
    }

    const target = await teammateMark()
    expect(target, "a teammate's mark to tap").toBeTruthy()
    const { x, y, player } = target!
    if (!hasTouch) {
      await page.mouse.move(x, y)
      if (name === "bars") await expect(chart.getByText(/\(\d+%\)/)).toBeVisible()
      await page.mouse.click(x, y)
      await expect(page).toHaveURL(`/players/${player}`)
      return
    }

    await expect(chart.getByText(prompt)).toBeVisible()
    await page.touchscreen.tap(x, y)
    const open = chart.getByRole("button", { name: /^View .+ →$/ })
    await expect(open).toBeVisible()
    await expect(page).toHaveURL(path)
    const chartBox = (await chart.getByRole("figure").boundingBox())!
    expect((await open.boundingBox())!.y, "details sit below the chart").toBeGreaterThanOrEqual(chartBox.y + chartBox.height)
    await open.tap()
    await expect(page).toHaveURL(`/players/${player}`)

    const again = (await teammateMark())!
    await page.touchscreen.tap(again.x, again.y)
    await expect(open).toBeVisible()
    await page.touchscreen.tap(again.x, again.y)
    await expect(page).toHaveURL(`/players/${again.player}`)

    if (name === "lines") {
      // A dot shows that week's numbers in the box too.
      await page.goto(path)
      await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 60_000 })
      await chart.locator("[data-tap-key^='dot:']").first().tap({ force: true })
      await expect(chart.locator("[aria-live=polite]")).toContainText(/W\d+/)
    }
  })
}

// Donuts: a point on slice `index`'s outer arc (its bounding-box center can
// fall in the hole).
async function slicePoint(chart: import("@playwright/test").Locator, index: number) {
  return chart.locator(".recharts-pie-sector path").nth(index).evaluate((path) => {
    const pt = path.getPointAtLength(path.getTotalLength() * 0.25)
    const m = path.getScreenCTM()!
    return { x: pt.x * m.a + m.e, y: pt.y * m.d + m.f }
  })
}

test("scoring composition slices show their points, by hover or by tap", async ({ page, hasTouch }) => {
  await page.goto("/teams/KC")
  const chart = page.locator("section", { has: page.getByRole("heading", { name: "Scoring Composition" }) })
  await chart.locator(".recharts-pie-sector path").first().waitFor({ timeout: 60_000 })
  await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 60_000 })
  await chart.scrollIntoViewIfNeeded()
  const { x, y } = await slicePoint(chart, 0)

  if (!hasTouch) {
    await page.mouse.move(x, y)
    await expect(chart.locator(".recharts-tooltip-wrapper")).toContainText(/Points\s*\d+ \(\d+%\)/)
    return
  }
  const box = chart.locator("[aria-live=polite]")
  await expect(box).toHaveText("Tap a slice to see its points.")
  await page.touchscreen.tap(x, y)
  await expect(box).toContainText(/Points\s*\d+ \(\d+%\)/)
  await expect(page).toHaveURL("/teams/KC")
  const chartBox = (await chart.getByRole("figure").boundingBox())!
  expect((await box.boundingBox())!.y, "details sit below the donut").toBeGreaterThanOrEqual(chartBox.y + chartBox.height)
})

test("season usage donut slices preview then open a teammate, by click or by tap", async ({ page, hasTouch }) => {
  const path = "/players/00-0030279"
  const chart = page.locator("section", { has: page.getByRole("button", { name: "Weekly" }) }).first()
  // Slice 0 is this player; slice 1 is their top teammate.
  async function teammateSlice() {
    await page.goto(path)
    await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 60_000 })
    await chart.getByRole("button", { name: "Season" }).click()
    await chart.locator(".recharts-pie-sector path").nth(1).waitFor()
    await chart.scrollIntoViewIfNeeded()
    return slicePoint(chart, 1)
  }

  const { x, y } = await teammateSlice()
  if (!hasTouch) {
    await page.mouse.click(x, y)
    await expect(page).toHaveURL(/\/players\/(?!00-0030279)[^/]+$/)
    return
  }
  await expect(chart.getByText("Tap a slice to see its numbers.")).toBeVisible()
  await page.touchscreen.tap(x, y)
  const open = chart.getByRole("button", { name: /^View .+ →$/ })
  await expect(open).toBeVisible()
  await expect(page).toHaveURL(path)
  await open.tap()
  await expect(page).toHaveURL(/\/players\/(?!00-0030279)[^/]+$/)

  const again = await teammateSlice()
  await page.touchscreen.tap(again.x, again.y)
  await expect(open).toBeVisible()
  await page.touchscreen.tap(again.x, again.y)
  await expect(page).toHaveURL(/\/players\/(?!00-0030279)[^/]+$/)
})

// League Comparison beeswarms: a mouse hovers a dot for its numbers, and a
// click highlights that player/team in every column (a second click opens
// their page). On a phone the chart scrolls sideways so its column labels
// don't collide, and a tap picks the nearest dot (dots are 3.5px, too small to
// hit exactly with a finger), showing its numbers below the chart.
const SWARMS = [
  { path: "/players/00-0033873", prompt: "Tap a dot to see that player's numbers.", opened: (id: string) => `/players/${id}` },
  { path: "/teams/KC", prompt: "Tap a dot to see that team's numbers.", opened: (id: string) => `/teams/${id}` },
  { path: "/players", prompt: "Tap a dot to see that player's numbers.", opened: (id: string) => `/players/${id}` },
  { path: "/teams", prompt: "Tap a dot to see that team's numbers.", opened: (id: string) => `/teams/${id}` },
]

for (const { path, prompt, opened } of SWARMS) {
  test(`league comparison dots on ${path} highlight then open, by click or by tap`, async ({ page, hasTouch }) => {
    // The page's own player/team, on their page; none on the league-wide pages.
    const self = path.split("/")[2]
    const chart = page.locator("section", { has: page.getByRole("heading", { name: "League Comparison" }) })
    // A point 12px right of some other player's/team's dot, where that dot is
    // still clearly the nearest one, and its id.
    async function nearDot(offset: number) {
      await page.goto(path)
      await chart.locator("[data-tap-key]").first().waitFor({ timeout: 60_000 })
      await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 60_000 })
      await chart.scrollIntoViewIfNeeded()
      return chart.evaluate(
        (section, { offset, self }) => {
          const view = section.ownerDocument.documentElement.clientWidth
          const dots = [...section.querySelectorAll("[data-tap-key]")].map((el) => {
            const r = el.getBoundingClientRect()
            return { key: el.getAttribute("data-tap-key")!, x: r.x + r.width / 2, y: r.y + r.height / 2 }
          })
          for (const dot of dots) {
            const id = dot.key.split(":")[1]
            const point = { x: dot.x + offset, y: dot.y }
            if (id === self || point.x > view - 8) continue
            const others = dots.filter((d) => d !== dot).map((d) => Math.hypot(d.x - point.x, d.y - point.y))
            if (Math.min(...others) > offset + 6) return { ...point, id }
          }
          return null
        },
        { offset, self },
      )
    }

    if (!hasTouch) {
      const target = (await nearDot(0))!
      await page.mouse.move(target.x, target.y)
      await expect(chart.locator("[data-hover-card]")).toContainText("Percentile")
      await page.mouse.click(target.x, target.y)
      await expect(chart.getByRole("button", { name: /^Stop highlighting / })).toBeVisible()
      await expect(chart.getByRole("figure")).toHaveAttribute("aria-label", /Highlighted: /)
      await expect(page).toHaveURL(path)
      await page.mouse.click(target.x, target.y)
      await expect(page).toHaveURL(opened(target.id))
      return
    }

    const target = await nearDot(12)
    expect(target, "a dot with room to tap beside it").toBeTruthy()
    await expect(chart.getByText(prompt)).toBeVisible()
    // Scrolls sideways, and its column labels don't run into each other.
    const scroller = chart.locator("[data-chart-marks]")
    expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth), "chart scrolls sideways").toBe(true)
    const overlaps = await chart.locator(".recharts-xAxis-tick-labels text").evaluateAll((labels) =>
      labels.slice(1).filter((label, i) => label.getBoundingClientRect().left < labels[i].getBoundingClientRect().right).length,
    )
    expect(overlaps, "column labels overlapping").toBe(0)

    await page.touchscreen.tap(target!.x, target!.y)
    const open = chart.getByRole("button", { name: /^View .+ →$/ })
    await expect(open).toBeVisible()
    await expect(page).toHaveURL(path)
    await open.tap()
    await expect(page).toHaveURL(opened(target!.id))

    const again = (await nearDot(12))!
    await page.touchscreen.tap(again.x, again.y)
    await expect(open).toBeVisible()
    await page.touchscreen.tap(again.x, again.y)
    await expect(page).toHaveURL(opened(again.id))
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


test("playmaking sits between overview and the depth chart", async ({ page }) => {
  await page.goto("/teams/KC")
  const tabs = page.getByRole("group", { name: "Team view" })
  await expect(tabs.getByRole("button")).toHaveText(["Overview", "Playmaking", "Depth Chart"])

  await tabs.getByRole("button", { name: "Playmaking" }).click()
  await expect(page).toHaveURL("/teams/KC?tab=playmaking")
  await expect(page.getByRole("heading", { name: "Game Log" })).toHaveCount(0)
})

test("playmaking shows share charts with nobody singled out", async ({ page }) => {
  await page.goto("/teams/KC?tab=playmaking")

  // The team wording - the player page says "<name>'s share of..." instead.
  await expect(page.getByRole("figure", { name: /^This team's backfield split/ })).toBeVisible()
  await expect(page.getByRole("figure", { name: /^This team's target split/ })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Red Zone Touches" })).toBeVisible()
})

test("team leaders switch stat without leaving the tab", async ({ page }) => {
  await page.goto("/teams/KC?tab=playmaking")
  const leaders = page.locator("section", { has: page.getByRole("heading", { name: "Team Leaders" }) })
  await expect(leaders.getByRole("link")).toHaveCount(5)

  await leaders.getByRole("button", { name: "Tackles" }).click()
  await expect(leaders.getByRole("button", { name: "Tackles" })).toHaveAttribute("aria-pressed", "true")
  await expect(leaders.getByRole("link")).toHaveCount(5)
  await expect(page).toHaveURL("/teams/KC?tab=playmaking")
})

test("play calling groups its rates and ranks each one", async ({ page, isMobile }) => {
  await page.goto("/teams/KC")
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Play Calling" }) })

  for (const group of ["Balance", "Formation", "Pass Location", "Run Direction", "Third Down"]) {
    await expect(panel.getByRole("heading", { name: group })).toBeVisible()
  }
  // Each split is one bar carrying both sides, with the team's and the
  // league's shares stacked.
  const split = panel.getByRole("figure", { name: /^Dropback \/ Run\./ })
  await expect(split).toBeVisible()
  await expect(split.getByText("Team")).toBeVisible()
  await expect(split.getByText("League")).toBeVisible()
  // Each row is its own target, so pointing at one highlights that row alone.
  const teamBar = split.getByRole("button", { name: /team$/ })
  // Hover on a mouse, tap on a phone - either way it's the same control.
  if (isMobile) await teamBar.tap()
  else await teamBar.hover()
  await expect(teamBar).toHaveAttribute("aria-pressed", "true")
  await expect(split.getByRole("button", { name: /league average$/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  )
})

test("team leaders expands to the whole league", async ({ page }) => {
  await page.goto("/teams")
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Team Leaders" }) })
  await expect(panel.getByRole("row")).toHaveCount(6, { timeout: 60_000 })

  await panel.getByRole("button", { name: "Show all teams" }).click()
  const modal = page.getByRole("dialog")
  // 32 teams plus the header row.
  await expect(modal.getByRole("row")).toHaveCount(33)

  // The two sack columns are told apart: taken on offense, recorded on defense.
  await expect(modal.getByRole("columnheader", { name: /SCK TKN/ })).toBeVisible()
})


test("a matchup slate links each game into its own page", async ({ page }) => {
  await page.goto("/matchups?week=1")
  const slate = page.locator("section", { has: page.getByRole("heading", { name: "Matchups" }) })
  await expect(slate.getByText("Week 1")).toBeVisible()

  // Week 1 is long played, so every game on this slate is final.
  await expect(slate.getByText("Final").first()).toBeVisible({ timeout: 60_000 })
  const first = slate.getByRole("link").first()
  const href = await first.getAttribute("href")
  await first.click()

  await expect(page).toHaveURL(href ?? "")
  await expect(page.getByRole("heading", { name: "Team Comparison" })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByRole("heading", { name: "Win Probability" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Drives" })).toBeVisible()
})

test("an upcoming game is previewed rather than broken down", async ({ page }) => {
  // The last week of the season can't have been played yet, whenever this runs.
  await page.goto("/matchups?week=18")
  const slate = page.locator("section", { has: page.getByRole("heading", { name: "Matchups" }) })
  await slate.getByRole("link").first().click()

  await expect(page.getByRole("heading", { name: "The Matchup" })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole("heading", { name: "Season Comparison" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Season Leaders" })).toBeVisible()
  // A game that hasn't been played has no result to break down.
  await expect(page.getByRole("heading", { name: "Win Probability" })).toBeHidden()
  await expect(page.getByRole("heading", { name: "Drives" })).toBeHidden()
})
