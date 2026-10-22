// teamColors.test.ts
// Tests the clash rule: four teams share #002244 in nflverse, so a pair of
// them has to be pulled apart before it's drawn.
import { describe, expect, it } from "vitest"
import type { TeamInfo } from "./teams"
import { contrastingPair, separation } from "./teamColors"

function team(abbr: string, color: string, color2: string): TeamInfo {
  return { team_abbr: abbr, team_color: color, team_color2: color2 } as TeamInfo
}

const teams = [
  team("DAL", "#002244", "#B0B7BC"),
  team("NE", "#002244", "#C60C30"),
  team("KC", "#E31837", "#FFB612"),
  // Dark green against navy separates at under 10, so this pair clashes even
  // though the two colours have different names.
  team("NYJ", "#003F2D", "#000000"),
]

describe("contrastingPair", () => {
  it("keeps both primaries when they're far enough apart", () => {
    expect(contrastingPair(teams, "KC", "NE")).toEqual(["#E31837", "#002244"])
  })

  it("pulls apart two dark colours that aren't the same colour", () => {
    // Jets green against Patriots navy separates at under 13, so New England
    // takes its red and the visitor keeps green.
    expect(contrastingPair(teams, "NYJ", "NE")).toEqual(["#003F2D", "#C60C30"])
  })

  it("shifts the home team, not the visitor, when the primaries clash", () => {
    expect(contrastingPair(teams, "DAL", "NE")).toEqual(["#002244", "#C60C30"])
  })

  it("falls back to the validated pair when a team isn't in the list", () => {
    expect(contrastingPair(teams, "DAL", "XXX")).toEqual(["#2a78d6", "#eb6834"])
  })
})

describe("separation", () => {
  it("is zero for the same colour and large for opposites", () => {
    expect(separation("#002244", "#002244")).toBe(0)
    expect(separation("#000000", "#ffffff")).toBeGreaterThan(90)
  })
})
