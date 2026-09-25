// playerMetrics.test.ts
// Tests for the median used by comparison charts and the /players query paths.
import { describe, expect, it } from "vitest"
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
})
