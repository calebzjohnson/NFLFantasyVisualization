// chartSummaries.test.ts
// Tests for the radar/beeswarm accessible summaries and table cells.
import { describe, expect, it } from "vitest"
import { percentileText, radarRows, radarSummary, swarmCell } from "./chartSummaries"

const axes = [
  { label: "EPA/Dropback", value: 0.21, percentile: 91.6 },
  { label: "Sack Rate", value: 7.5, percentile: 12.2 },
  { label: "Deep Ball", value: null, percentile: null },
]

describe("chartSummaries", () => {
  it("rounds percentiles to ordinals", () => {
    expect(percentileText(91.6)).toBe("92nd")
    expect(percentileText(null)).toBeNull()
  })

  it("summarizes a radar with its strongest and weakest stat", () => {
    expect(radarSummary("Josh Allen", "every other qualifying QB", axes)).toBe(
      "Josh Allen compared with every other qualifying QB this season on 3 stats, as percentile ranks where 50 is league average. Strongest: EPA/Dropback (92nd). Weakest: Sack Rate (12th).",
    )
  })

  it("omits strongest/weakest when nothing is ranked", () => {
    expect(radarSummary("X", "peers", [{ label: "A", value: null, percentile: null }])).not.toMatch(/Strongest/)
  })

  it("builds one table row per radar stat", () => {
    expect(radarRows(axes)).toEqual([
      ["EPA/Dropback", 0.21, "92nd"],
      ["Sack Rate", 7.5, "12th"],
      ["Deep Ball", null, null],
    ])
  })

  it("formats beeswarm cells as value with percentile", () => {
    expect(swarmCell({ value: 0.21, percentile: 82.4 })).toBe("0.21 (82nd)")
    expect(swarmCell({ value: 3, percentile: null })).toBe("3")
    expect(swarmCell({ value: null, percentile: 50 })).toBeNull()
  })
})
