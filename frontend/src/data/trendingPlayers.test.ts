// trendingPlayers.test.ts
// Tests for trend slopes, top-5 selection, and which players qualify to trend.
import { describe, expect, it } from "vitest"
import { PLAYER_METRICS } from "./playerMetrics"
import { slope, topTrends, trendingPlayers, type TrendLine, type WeeklyPlayerRow } from "./trendingPlayers"

function line(id: string, lineSlope: number): TrendLine {
  return { id, name: id, team: "AAA", headshot: null, slope: lineSlope, games: [] }
}

function week(playerId: string, weekNumber: number, targets: number, yards: number): WeeklyPlayerRow {
  return {
    player_id: playerId,
    player_display_name: playerId,
    team: "AAA",
    headshot_url: null,
    week: weekNumber,
    targets,
    receiving_yards: yards,
  }
}

describe("slope", () => {
  it("is the least-squares slope of y over x", () => {
    expect(slope([{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 3, y: 5 }])).toBe(2)
  })

  it("isn't thrown off by a bye (a gap in x)", () => {
    expect(slope([{ x: 1, y: 10 }, { x: 2, y: 20 }, { x: 4, y: 40 }])).toBeCloseTo(10)
  })

  it("is 0 when every point shares one x", () => {
    expect(slope([{ x: 3, y: 1 }, { x: 3, y: 9 }])).toBe(0)
  })
})

describe("topTrends", () => {
  it("keeps the 5 steepest each way, steepest first, and drops flat lines", () => {
    const lines = [0, 1, 2, 3, 4, 5, 6, -1, -2].map((s) => line(`p${s}`, s))
    const { up, down } = topTrends(lines)

    expect(up.map((l) => l.slope)).toEqual([6, 5, 4, 3, 2])
    expect(down.map((l) => l.slope)).toEqual([-2, -1])
  })
})

describe("trendingPlayers", () => {
  const receivingYards = PLAYER_METRICS.WR.find((m) => m.key === "receiving_yards")!

  it("scores the last-5-week window and skips barely-involved or one-game players", () => {
    const rows = [
      // Rising; week 1 is outside the week 2-6 window, so its 1000 yards are ignored.
      ...[1, 2, 3, 4, 5, 6].map((w) => week("rising", w, 10, w === 1 ? 1000 : w * 10)),
      ...[2, 3, 4, 5, 6].map((w) => week("falling", w, 5, 100 - w * 10)),
      // Under 20% of the top workload (10 targets) - not a real trend.
      ...[2, 3, 4, 5, 6].map((w) => week("barely-used", w, 1, w * 50)),
      week("one-game", 6, 10, 200),
    ]

    const { up, down } = trendingPlayers(rows, receivingYards, "WR")

    expect(up.map((l) => l.id)).toEqual(["rising"])
    expect(up[0].slope).toBeCloseTo(10)
    expect(down.map((l) => l.id)).toEqual(["falling"])
  })

  it("returns nothing for no rows", () => {
    expect(trendingPlayers([], receivingYards, "WR")).toEqual({ up: [], down: [] })
  })
})
