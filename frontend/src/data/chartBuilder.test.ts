// chartBuilder.test.ts
// Tests for the Create page's rules: URL parsing and limits, the stats a mix of positions shares, the default stat, and the bar rows and lines built from picks.
import { describe, expect, it } from "vitest"
import {
  availableMetrics,
  barRows,
  builderParams,
  chartStats,
  parseBuilder,
  pickColor,
  pickedLines,
  meetsPoolFloor,
  percentileColumns,
  poolFloor,
  seasonWeek,
  type BuilderState,
  type Picked,
} from "./chartBuilder"
import { PLAYER_METRICS } from "./playerMetrics"
import { TEAM_METRICS } from "./teamMetrics"

const keys = (metrics: { key: string }[]) => metrics.map((metric) => metric.key)

function state(overrides: Partial<BuilderState> = {}): BuilderState {
  return { kind: "players", type: "bar", ids: [], stats: null, ...overrides }
}

const PICKS: Picked[] = [
  { id: "a", name: "A Player", team: "BUF", href: "/players/a" },
  { id: "b", name: "B Player", team: "KC", href: "/players/b" },
]

describe("parseBuilder", () => {
  it("defaults to a players bar chart with nothing picked", () => {
    expect(parseBuilder(new URLSearchParams())).toEqual(state())
  })

  it("reads every field, dropping duplicates and unknown kinds or types", () => {
    const params = new URLSearchParams("kind=teams&type=line&ids=KC,BUF,KC&stats=points")
    expect(parseBuilder(params)).toEqual(state({ kind: "teams", type: "line", ids: ["KC", "BUF"], stats: ["points"] }))
    expect(parseBuilder(new URLSearchParams("kind=coaches&type=pie"))).toEqual(state())
  })

  it("tells stats never picked (no stats param) from all turned off (an empty one)", () => {
    expect(parseBuilder(new URLSearchParams("ids=1")).stats).toBeNull()
    expect(parseBuilder(new URLSearchParams("ids=1&stats=")).stats).toEqual([])
  })

  it("keeps at most five picks", () => {
    expect(parseBuilder(new URLSearchParams("ids=1,2,3,4,5,6")).ids).toEqual(["1", "2", "3", "4", "5"])
  })

  it("round-trips through builderParams, keeping an emptied stat list but no unpicked one", () => {
    const full = state({ kind: "teams", ids: ["KC"], stats: ["points", "yards"] })
    expect(parseBuilder(new URLSearchParams(builderParams(full)))).toEqual(full)
    const cleared = state({ ids: ["KC"], stats: [] })
    expect(parseBuilder(new URLSearchParams(builderParams(cleared)))).toEqual(cleared)
    expect(builderParams(state())).toEqual({ kind: "players", type: "bar" })
  })
})

describe("availableMetrics", () => {
  it("offers every team stat for teams", () => {
    expect(availableMetrics("teams", [])).toBe(TEAM_METRICS)
  })

  it("offers nothing until a player's position is known", () => {
    expect(availableMetrics("players", [])).toEqual([])
  })

  it("offers a single position its whole catalog", () => {
    expect(availableMetrics("players", ["QB"])).toEqual(PLAYER_METRICS.QB)
  })

  it("offers a mix of positions only the stats they all have, in the first pick's order", () => {
    const shared = keys(availableMetrics("players", ["WR", "RB"]))
    expect(shared).toContain("targets")
    expect(shared).toContain("fantasy_points_ppr")
    expect(shared).not.toContain("carries") // RB only
    expect(shared).not.toContain("receiving_tds") // WR only
    expect(shared).toEqual(keys(PLAYER_METRICS.WR).filter((key) => shared.includes(key)))
  })
})

describe("chartStats", () => {
  const metrics = PLAYER_METRICS.WR

  it("keeps the picked stats that are available, up to the chart's limit", () => {
    const picked = ["targets", "carries", "receptions", "receiving_yards", "receiving_tds", "ypr"]
    expect(keys(chartStats(state({ stats: picked }), metrics))).toEqual([
      "targets",
      "receptions",
      "receiving_yards",
      "receiving_tds",
    ])
    expect(keys(chartStats(state({ type: "line", stats: picked }), metrics))).toEqual(["targets"])
  })

  it("draws nothing on a bar chart the user cleared, but a line chart still needs a stat", () => {
    expect(chartStats(state({ stats: [] }), metrics)).toEqual([])
    expect(keys(chartStats(state({ type: "line", stats: [] }), metrics))).toEqual(["fantasy_points_ppr"])
  })

  it("falls back to fantasy points, else the first stat", () => {
    expect(keys(chartStats(state({ stats: ["carries"] }), metrics))).toEqual(["fantasy_points_ppr"])
    expect(keys(chartStats(state(), TEAM_METRICS))).toEqual([TEAM_METRICS[0].key])
    expect(chartStats(state(), [])).toEqual([])
  })
})

describe("chartStats for scatters and beeswarms", () => {
  const wr = PLAYER_METRICS.WR

  it("gives a scatter exactly two axes, topping up a single pick from the defaults", () => {
    expect(keys(chartStats(state({ type: "scatter" }), wr))).toEqual(["fantasy_points_ppr", "receptions"])
    expect(keys(chartStats(state({ type: "scatter", stats: ["targets"] }), wr))).toEqual(["targets", "fantasy_points_ppr"])
    expect(keys(chartStats(state({ type: "scatter", stats: ["targets", "ypr", "receiving_tds"] }), wr))).toEqual(["targets", "ypr"])
    // Teams start on points scored vs. allowed, like Compare Teams.
    expect(keys(chartStats(state({ type: "scatter" }), TEAM_METRICS))).toEqual(["points", "points_allowed"])
  })

  it("starts a beeswarm on three columns, takes up to six, and draws none once cleared", () => {
    expect(keys(chartStats(state({ type: "beeswarm" }), TEAM_METRICS))).toEqual(["points", "points_allowed", "yards"])
    expect(chartStats(state({ type: "beeswarm", stats: keys(wr) }), wr)).toHaveLength(6)
    expect(chartStats(state({ type: "beeswarm", stats: [] }), wr)).toEqual([])
    // A scatter can't be emptied: it always has its two axes.
    expect(chartStats(state({ type: "scatter", stats: [] }), wr)).toHaveLength(2)
  })
})

describe("percentileColumns", () => {
  const metric = (key: string) => Object.values(PLAYER_METRICS).flat().find((m) => m.key === key)!
  const entry = (id: string, row: Record<string, number>) => ({ id, name: `Player ${id}`, team: "KC", row })
  const cell = (rows: ReturnType<typeof percentileColumns>, id: string, key: string) =>
    rows.find((row) => row.id === id)!.axes.find((axis) => axis.key === key)!

  it("ranks like the radar: the best is 100, ties share the average rank", () => {
    const rows = percentileColumns(
      [entry("a", { targets: 10 }), entry("b", { targets: 30 }), entry("c", { targets: 10 }), entry("d", { targets: 20 })],
      [metric("targets")],
      new Set(),
    )
    expect(["a", "b", "c", "d"].map((id) => cell(rows, id, "targets").percentile)).toEqual([37.5, 100, 37.5, 75])
    expect(cell(rows, "b", "targets").value).toBe("30")
  })

  it("ranks a lower-is-better stat in reverse, so fewer interceptions rank higher", () => {
    const rows = percentileColumns(
      [entry("a", { passing_interceptions: 2 }), entry("b", { passing_interceptions: 9 })],
      [metric("passing_interceptions")],
      new Set(),
    )
    expect(cell(rows, "a", "passing_interceptions").percentile).toBe(100)
    expect(cell(rows, "b", "passing_interceptions").percentile).toBe(50)
  })

  it("leaves players under a per-play stat's minimum out of its column, unless they're picks", () => {
    const pool = [
      entry("starter", { carries: 100, rushing_yards: 450 }),
      entry("backup", { carries: 3, rushing_yards: 30 }),
      entry("pick", { carries: 4, rushing_yards: 8 }),
    ]
    const rows = percentileColumns(pool, [metric("ypc"), metric("carries")], new Set(["pick"]))
    expect(cell(rows, "backup", "ypc")).toEqual({ key: "ypc", value: null, percentile: null })
    expect(cell(rows, "pick", "ypc").percentile).toBe(50)
    // A total ranks everyone.
    expect(cell(rows, "backup", "carries").percentile).not.toBeNull()
  })
})

describe("beeswarm pool floor", () => {
  it("scales the radar's per-week volume floor by the week, with none for positions without a profile", () => {
    expect(poolFloor("QB", 6)).toMatchObject({ field: "attempts", min: 37.5 })
    expect(meetsPoolFloor({ targets: 12 }, "WR", 6)).toBe(true)
    expect(meetsPoolFloor({ targets: 11 }, "WR", 6)).toBe(false)
    expect(meetsPoolFloor({ defense_snaps: 89 }, "CB", 6)).toBe(false)
    expect(poolFloor("K", 6)).toBeNull()
    expect(meetsPoolFloor({}, "K", 6)).toBe(true)
  })

  it("counts only regular-season weeks", () => {
    expect(seasonWeek({ week: 6, season_type: "REG" })).toBe(6)
    expect(seasonWeek({ week: 20, season_type: "POST" })).toBe(18)
  })
})

describe("barRows", () => {
  it("gives each pick its color and values in pick order, with null values for a pick without stats", () => {
    const [targets] = PLAYER_METRICS.WR.filter((metric) => metric.key === "targets")
    const rows = barRows(PICKS, new Map([["a", { targets: 7 }]]), [targets])
    expect(rows.map((row) => [row.id, row.color, row.values])).toEqual([
      ["a", pickColor(0), { targets: 7 }],
      ["b", pickColor(1), { targets: null }],
    ])
  })

  it("flags a per-play stat a pick has too few plays for, with the count", () => {
    const ypc = PLAYER_METRICS.RB.find((metric) => metric.key === "ypc")!
    const rows = barRows(
      PICKS,
      new Map([
        ["a", { carries: 4, rushing_yards: 30 }],
        ["b", { carries: 10, rushing_yards: 40 }],
      ]),
      [ypc],
    )
    expect(rows.map((row) => row.smallSamples)).toEqual([{ ypc: 4 }, {}])
  })
})

describe("pickedLines", () => {
  const [points] = TEAM_METRICS
  const games = [
    { team: "BUF", week: 3, points_for: 30 },
    { team: "BUF", week: 1, points_for: 20 },
    { team: "MIA", week: 1, points_for: 17 },
  ]

  it("draws each pick's games in week order, in its pick color, and skips picks with no games", () => {
    const picks: Picked[] = [
      { id: "KC", name: "KC Team", team: "KC", href: "/teams/KC" },
      { id: "BUF", name: "BUF Team", team: "BUF", href: "/teams/BUF", logo: "buf.png" },
    ]
    const lines = pickedLines(picks, games, "team", points)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ id: "BUF", logo: "buf.png", color: pickColor(1), slope: 5 })
    expect(lines[0].games).toEqual([
      { week: 1, value: 20 },
      { week: 3, value: 30 },
    ])
  })
})
