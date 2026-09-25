// efficiency.test.ts
// Tests for the team efficiency join, ranks, league averages, and formatting.
import { describe, expect, it } from "vitest"
import { teamInfo } from "../test/fixtures"
import { formatEpa, leagueAverages, ordinal, toTeamPoints, type TeamEfficiency } from "./efficiency"

function efficiency(team: string, offense: number | null, defense: number | null, plays = 100): TeamEfficiency {
  return {
    team,
    offensive_epa_per_play: offense,
    offensive_plays: plays,
    defensive_epa_per_play: defense,
    defensive_plays: plays,
  }
}

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [32, "32nd"],
    [111, "111th"],
  ])("%i -> %s", (n, expected) => {
    expect(ordinal(n)).toBe(expected)
  })
})

describe("formatEpa", () => {
  it("signs positive and negative values with a true minus sign", () => {
    expect(formatEpa(0.374)).toBe("+0.37")
    expect(formatEpa(-0.13)).toBe("−0.13")
  })

  it("shows values that round to zero as an unsigned 0.00", () => {
    expect(formatEpa(0.001)).toBe("0.00")
    expect(formatEpa(-0.004)).toBe("0.00")
  })
})

describe("toTeamPoints", () => {
  const teams = [teamInfo("AAA"), teamInfo("BBB"), teamInfo("CCC")]

  it("ranks offense highest-first and defense lowest-first", () => {
    const points = toTeamPoints([efficiency("AAA", 0.2, 0.1), efficiency("BBB", 0.1, -0.1)], teams)
    const byTeam = new Map(points.map((p) => [p.team, p]))

    expect(byTeam.get("AAA")).toMatchObject({ offenseRank: 1, defenseRank: 2, name: "AAA Team" })
    expect(byTeam.get("BBB")).toMatchObject({ offenseRank: 2, defenseRank: 1 })
  })

  it("drops teams with missing numbers or no registry entry", () => {
    const points = toTeamPoints(
      [efficiency("AAA", 0.2, 0.1), efficiency("CCC", null, 0.1), efficiency("ZZZ", 0.1, 0.1)],
      teams,
    )
    expect(points.map((p) => p.team)).toEqual(["AAA"])
  })
})

describe("leagueAverages", () => {
  it("weights each team by its play count", () => {
    const points = toTeamPoints(
      [efficiency("AAA", 0.3, 0.0, 300), efficiency("BBB", -0.1, 0.4, 100)],
      [teamInfo("AAA"), teamInfo("BBB")],
    )
    const average = leagueAverages(points)
    expect(average.offense).toBeCloseTo(0.2) // (0.3*300 - 0.1*100) / 400
    expect(average.defense).toBeCloseTo(0.1) // (0*300 + 0.4*100) / 400
  })
})
