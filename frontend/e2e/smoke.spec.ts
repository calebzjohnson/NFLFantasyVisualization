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

// Same pattern on the scatters: hover/click with a mouse; on a touchscreen a
// tap shows the mark's numbers below the chart, and the box's button or a
// second tap opens its page.
const SCATTERS = [
  { path: "/", heading: "Team Efficiency", opened: /\/teams\/[A-Z]+$/ },
  { path: "/teams", heading: "Compare Teams", opened: /\/teams\/[A-Z]+$/ },
  { path: "/players", heading: "Compare Players", opened: /\/players\/[^/]+$/ },
]

for (const { path, heading, opened } of SCATTERS) {
  test(`${heading} marks preview then open, by hover or by tap`, async ({ page, hasTouch }) => {
    const chart = page.locator("section", { has: page.getByRole("heading", { name: heading }) }).first()
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
      await expect(chart.locator(".recharts-tooltip-wrapper")).toHaveCSS("visibility", "visible")
      await mark.click({ force: true })
      await expect(page).toHaveURL(opened)
      return
    }

    await expect(chart.getByText(/^Tap a (logo|player) to see/)).toBeVisible()
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

// League Comparison beeswarms: hover/click a dot with a mouse. On a phone the
// chart scrolls sideways so its column labels don't collide, and a tap picks
// the nearest dot (dots are 3.5px, too small to hit exactly with a finger).
const SWARMS = [
  { path: "/players/00-0033873", prompt: "Tap a dot to see that player's numbers.", opened: (id: string) => `/players/${id}` },
  { path: "/teams/KC", prompt: "Tap a dot to see that team's numbers.", opened: (id: string) => `/teams/${id}` },
]

for (const { path, prompt, opened } of SWARMS) {
  test(`league comparison dots on ${path} preview then open, by hover or by tap`, async ({ page, hasTouch }) => {
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
      await expect(chart.locator(".recharts-tooltip-wrapper")).toContainText("Percentile")
      await page.mouse.click(target.x, target.y)
      await expect(page).toHaveURL(opened(target.id))
      return
    }

    const target = await nearDot(12)
    expect(target, "a dot with room to tap beside it").toBeTruthy()
    await expect(chart.getByText(prompt)).toBeVisible()
    // Scrolls sideways, and its column labels don't run into each other.
    const scroller = chart.locator("[data-swarm-chart]")
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

test("play calling groups its rates and ranks each one", async ({ page }) => {
  await page.goto("/teams/KC")
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Play Calling" }) })

  for (const group of ["Balance", "Formation", "Run Direction", "Tempo", "Conversions"]) {
    await expect(panel.getByRole("heading", { name: group })).toBeVisible()
  }
  // Both sides of a split are listed, so nothing has to be inferred.
  await expect(panel.getByText("Dropback Rate")).toBeVisible()
  await expect(panel.getByText("Run Rate", { exact: true })).toBeVisible()
  // Every rate carries a league rank.
  await expect(panel.getByText(/^\d+(st|nd|rd|th)$/).first()).toBeVisible()
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
