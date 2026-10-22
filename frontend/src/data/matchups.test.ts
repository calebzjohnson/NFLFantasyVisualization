// matchups.test.ts
// Tests the shaping a matchup needs: offense paired against the opposing
// defense and drives split per team.
import { describe, expect, it } from "vitest"
import {
  driveScored,
  drivesByTeam,
  edgesFor,
  epaWidth,
  formatEpa,
  type Drive,
  type MatchupTeam,
} from "./matchups"

function rate(epa: number) {
  return { plays: 10, epa: epa * 10, epa_per_play: epa, success_rate: 45 }
}

function team(name: string, offense: number, defense: number): MatchupTeam {
  return {
    team: name,
    offense: { plays: 30, overall: rate(offense), pass: rate(offense), run: rate(offense) },
    defense: { plays: 30, overall: rate(defense), pass: rate(defense), run: rate(defense) },
  }
}

describe("edgesFor", () => {
  it("pairs one team's offense against the other's defense", () => {
    const edges = edgesFor(team("DAL", 0.2, -0.1), team("NYG", 0.05, 0.08))

    expect(edges.map((edge) => edge.label)).toEqual(["Overall", "Pass", "Run"])
    expect(edges[0].offense).toEqual({ team: "DAL", rate: rate(0.2) })
    expect(edges[0].defense).toEqual({ team: "NYG", rate: rate(0.08) })
  })
})

describe("driveScored", () => {
  it("counts the drives that put points up", () => {
    expect(driveScored({ result: "Touchdown" } as Drive)).toBe(true)
    expect(driveScored({ result: "Field goal" } as Drive)).toBe(true)
    expect(driveScored({ result: "Punt" } as Drive)).toBe(false)
    expect(driveScored({ result: null } as Drive)).toBe(false)
  })
})

describe("drivesByTeam", () => {
  it("splits one interleaved list into a timeline per team", () => {
    const drives = [
      { drive: 1, team: "DAL" },
      { drive: 2, team: "NYG" },
      { drive: 3, team: "DAL" },
    ] as Drive[]

    expect(drivesByTeam(drives, ["DAL", "NYG"])).toEqual({
      DAL: [drives[0], drives[2]],
      NYG: [drives[1]],
    })
  })

  it("gives a team that never had the ball an empty timeline, not a missing key", () => {
    expect(drivesByTeam([], ["DAL", "NYG"])).toEqual({ DAL: [], NYG: [] })
  })
})

describe("formatEpa", () => {
  it("signs the number, since the sign is the whole reading", () => {
    expect(formatEpa(0.144)).toBe("+0.14")
    expect(formatEpa(-0.244)).toBe("-0.24")
    expect(formatEpa(null)).toBe("—")
  })
})

describe("epaWidth", () => {
  it("scales against ±0.5 and pins beyond it", () => {
    expect(epaWidth(0.25)).toBe(50)
    expect(epaWidth(-0.25)).toBe(50)
    expect(epaWidth(0.9)).toBe(100)
    expect(epaWidth(null)).toBe(0)
  })
})
