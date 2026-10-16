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
