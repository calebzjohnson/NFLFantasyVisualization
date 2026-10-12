// depthChart.test.ts
// Tests the depth-column headers, which widen to the group's deepest slot.
import { describe, expect, it } from "vitest"
import { depthColumns, depthLabel, type DepthChartGroup, type DepthChartPlayer } from "./depthChart"

function player(name: string, rank: number): DepthChartPlayer {
  return { player_id: name, name, rank, status: null, injury: null }
}

function group(depths: number[]): DepthChartGroup {
  return {
    key: "offense",
    label: "3WR 1TE",
    slots: depths.map((depth, index) => ({
      slot: index,
      position: `P${index}`,
      position_name: `Position ${index}`,
      players: Array.from({ length: depth }, (_, i) => player(`P${index}-${i}`, i + 1)),
    })),
  }
}

describe("depthLabel", () => {
  it("names the first ten places and falls back past them", () => {
    expect([0, 1, 2, 5].map(depthLabel)).toEqual(["1st", "2nd", "3rd", "6th"])
    expect(depthLabel(11)).toBe("12th")
  })
})

describe("depthColumns", () => {
  it("widens to the deepest slot in the group", () => {
    expect(depthColumns(group([2, 5, 1]))).toEqual(["1st", "2nd", "3rd", "4th", "5th"])
  })

  it("returns nothing when no slot has a player", () => {
    expect(depthColumns(group([]))).toEqual([])
    expect(depthColumns(group([0]))).toEqual([])
  })
})
