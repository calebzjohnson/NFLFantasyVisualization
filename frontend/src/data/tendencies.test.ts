// tendencies.test.ts
// Tests the pairing: which rates already come as two halves, and which have
// their other half derived so every bar fills.
import { describe, expect, it } from "vitest"
import { shortLabel, toBars, type Tendency } from "./tendencies"

function rate(key: string, label: string, value: number, group = "Balance"): Tendency {
  return { key, label, group, value, rank: 3, teams: 32, league_average: value + 1 }
}

describe("toBars", () => {
  it("pairs consecutive rates that already sum to 100", () => {
    const bars = toBars([
      rate("dropback_rate", "Dropback Rate", 56.7),
      rate("run_rate", "Run Rate", 43.3),
    ])

    expect(bars).toHaveLength(1)
    expect(bars[0].segments.map((s) => [s.label, s.value])).toEqual([
      ["Dropback", 56.7],
      ["Run", 43.3],
    ])
  })

  it("derives the other half for a rate that arrives alone", () => {
    const bars = toBars([
      rate("third_down_conversion", "Third Down Conversion", 51.9, "Conversions"),
    ])

    expect(bars[0].segments.map((s) => [s.label, s.value])).toEqual([
      ["Converted", 51.9],
      ["Failed", 48.1],
    ])
  })

  it("derives the league average's other half too, so both bars fill", () => {
    const bars = toBars([
      rate("fourth_down_conversion", "Fourth Down Conversion", 50, "Conversions"),
    ])

    const [converted, failed] = bars[0].segments
    expect(converted.leagueAverage + failed.leagueAverage).toBeCloseTo(100)
  })

  it("won't pair across a group boundary", () => {
    const bars = toBars([
      rate("deep_pass_rate", "Deep Pass Rate", 40, "Pass Depth"),
      rate("inside_run_rate", "Inside Run Rate", 60, "Run Direction"),
    ])

    expect(bars).toHaveLength(2)
  })

  it("keeps two separate splits in one group apart", () => {
    const bars = toBars([
      rate("dropback_rate", "Dropback Rate", 56.7),
      rate("run_rate", "Run Rate", 43.3),
      rate("early_down_run_rate", "Early-Down Run Rate", 47.7),
      rate("early_down_pass_rate", "Early-Down Pass Rate", 52.3),
    ])

    expect(bars.map((bar) => bar.key)).toEqual(["dropback_rate", "early_down_run_rate"])
  })

  it("keeps each side's own rank", () => {
    const a = rate("dropback_rate", "Dropback Rate", 56.7)
    const b = { ...rate("run_rate", "Run Rate", 43.3), rank: 30 }
    const [bar] = toBars([a, b])

    expect(bar.segments.map((segment) => segment.rank)).toEqual([3, 30])
  })

  it("reverses the rank on a derived half: most converted is least failed", () => {
    const [bar] = toBars([
      rate("third_down_conversion", "Third Down Conversion", 51.9, "Conversions"),
    ])

    expect(bar.segments.map((segment) => segment.rank)).toEqual([3, 30])
  })
})

describe("shortLabel", () => {
  it("drops the trailing noun the bar already implies", () => {
    expect(shortLabel("Dropback Rate")).toBe("Dropback")
    expect(shortLabel("Third Down Conversion")).toBe("Third Down")
    expect(shortLabel("Under-Center Pass Rate")).toBe("Under-Center Pass")
  })
})
