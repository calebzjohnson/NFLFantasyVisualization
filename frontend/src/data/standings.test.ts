// standings.test.ts
// Tests for win-percentage and record formatting, and finding one team's standing.
import { describe, expect, it } from "vitest"
import { teamRecord } from "../test/fixtures"
import { findTeamStanding, formatPct, formatRecord, type DivisionStanding } from "./standings"

describe("formatPct", () => {
  it("drops the leading zero", () => {
    expect(formatPct(0.5)).toBe(".500")
  })

  it("keeps a perfect record as 1.000", () => {
    expect(formatPct(1)).toBe("1.000")
  })
})

describe("formatRecord", () => {
  it("shows wins-losses", () => {
    expect(formatRecord(teamRecord("A", { wins: 2, losses: 1 }))).toBe("2-1")
  })

  it("adds ties only when there are some", () => {
    expect(formatRecord(teamRecord("A", { wins: 2, losses: 1, ties: 1 }))).toBe("2-1-1")
  })
})

describe("findTeamStanding", () => {
  const standings: DivisionStanding[] = [
    { division: "AFC East", teams: [teamRecord("BUF"), teamRecord("MIA")] },
    { division: "NFC East", teams: [teamRecord("PHI"), teamRecord("DAL")] },
  ]

  it("returns the team's record, division, and 1-based place", () => {
    expect(findTeamStanding(standings, "DAL")).toEqual({
      record: teamRecord("DAL"),
      division: "NFC East",
      place: 2,
    })
  })

  it("returns null for a team not in the standings", () => {
    expect(findTeamStanding(standings, "ZZZ")).toBeNull()
  })
})
