// teams.test.ts
// Tests for team page URLs and the team -> logo lookup.
import { describe, expect, it } from "vitest"
import { teamInfo } from "../test/fixtures"
import { logoByTeam, teamPath } from "./teams"

describe("teamPath", () => {
  it("builds /teams/:abbr", () => {
    expect(teamPath("KC")).toBe("/teams/KC")
  })

  it("escapes anything that isn't URL-safe", () => {
    expect(teamPath("A/B")).toBe("/teams/A%2FB")
  })
})

describe("logoByTeam", () => {
  it("maps each abbreviation to its resized logo", () => {
    expect(logoByTeam([teamInfo("KC")]).get("KC")).toContain("combiner")
  })

  it("is empty before teams load", () => {
    expect(logoByTeam(null).size).toBe(0)
  })
})
