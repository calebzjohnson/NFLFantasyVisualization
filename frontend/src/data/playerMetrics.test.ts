// playerMetrics.test.ts
// Tests for the median used by comparison charts, the /players query paths, and the metric formulas.
import { describe, expect, it } from "vitest"
import { readFields } from "../test/readFields"
import { POSITION_GROUPS } from "./leaderCategories"
import { metricMedian, PLAYER_METRICS, playersPathForPosition, playersWeeklyPathForPosition } from "./playerMetrics"

const yards = PLAYER_METRICS.WR.find((m) => m.key === "receiving_yards")!

describe("metricMedian", () => {
  it("takes the middle value of an odd count", () => {
    expect(metricMedian([{ receiving_yards: 10 }, { receiving_yards: 900 }, { receiving_yards: 30 }], yards)).toBe(30)
  })

  it("averages the two middle values of an even count", () => {
    expect(metricMedian([{ receiving_yards: 10 }, { receiving_yards: 20 }, { receiving_yards: 40 }, { receiving_yards: 1000 }], yards)).toBe(30)
  })

  it("is 0 with no rows", () => {
    expect(metricMedian([], yards)).toBe(0)
  })
})

describe("query paths", () => {
  it("asks /players for the position and every field its metrics need", () => {
    const params = new URL(playersPathForPosition("QB"), "http://x").searchParams
    expect(params.get("position_group")).toBe("QB")
    expect(params.get("fields")?.split(",")).toEqual(expect.arrayContaining(["player_id", "passing_yards", "passing_cpoe"]))
  })

  it("asks /players/weekly for the week and team fields too", () => {
    const url = new URL(playersWeeklyPathForPosition("RB"), "http://x")
    expect(url.pathname).toBe("/players/weekly")
    expect(url.searchParams.get("fields")?.split(",")).toEqual(expect.arrayContaining(["week", "team", "carries"]))
  })

  it("asks /players/weekly for the position's snap share, once, and none for kickers", () => {
    const fields = (position: "WR" | "DL" | "K") =>
      new URL(playersWeeklyPathForPosition(position), "http://x").searchParams.get("fields")!.split(",")
    expect(fields("WR")).toContain("offense_snap_pct")
    expect(fields("DL").filter((f) => f === "defense_snap_pct")).toHaveLength(1)
    expect(fields("K").some((f) => f.endsWith("snap_pct"))).toBe(false)
  })
})

describe("metric catalogs", () => {
  it.each(POSITION_GROUPS)("%s requests every field its metrics read", (position) => {
    const requested = new URL(playersPathForPosition(position), "http://x").searchParams.get("fields")!.split(",")
    for (const metric of PLAYER_METRICS[position]) {
      expect(requested, metric.key).toEqual(expect.arrayContaining(readFields(metric.value)))
    }
  })

  it("computes missed tackle % against tackle attempts (made + missed)", () => {
    const missed = PLAYER_METRICS.LB.find((m) => m.key === "missed_tackle_pct")!
    // 1 missed out of 10 attempts (9 made).
    expect(missed.value({ def_tackles_solo: 5, def_tackle_assists: 4, def_missed_tackles: 1 })).toBe(10)
  })

  it("gives defenders, linemen, and specialists no fantasy points metric", () => {
    for (const position of ["DL", "LB", "DB", "OL", "K", "P"] as const) {
      expect(PLAYER_METRICS[position].map((m) => m.key)).not.toContain("fantasy_points_ppr")
    }
  })
})
