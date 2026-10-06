// gameLog.test.ts
// Tests for the roster-position mapping and the new groups' game log rows and season totals.
import { describe, expect, it } from "vitest"
import { gameLogConfigForPosition, positionGroupFor, type GameStatsRow } from "./gameLog"

function game(week: number, fields: Record<string, number | null>): GameStatsRow {
  return { week, opponent_team: "NYG", ...fields }
}

describe("positionGroupFor", () => {
  it.each([
    ["OLB", "LB"],
    ["SAF", "S"],
    ["CB", "CB"],
    ["NT", "DL"],
    ["OT", "OL"],
    ["C", "OL"],
    ["FB", "RB"],
    ["K", "K"],
  ])("puts %s in %s", (position, group) => {
    expect(positionGroupFor(position)).toBe(group)
  })

  it("has no group for long snappers or a missing position", () => {
    expect(positionGroupFor("LS")).toBeNull()
    expect(positionGroupFor(null)).toBeNull()
    expect(gameLogConfigForPosition("LS")).toBeNull()
  })
})

describe("offensive line game log", () => {
  const config = gameLogConfigForPosition("G")!

  it("shows a quiet week (null box score) as zero penalties, not NaN", () => {
    const stats = config.toStats(game(1, { offense_snaps: 60, offense_team_snaps: 60, penalties: null }))
    expect(stats).toEqual({ snaps: 60, snapPct: 100, pen: 0, penYards: 0 })
  })

  it("totals snap share from summed snaps, not an average of weekly percentages", () => {
    const totals = config.toTotals([
      game(1, { offense_snaps: 60, offense_team_snaps: 60, penalties: 1 }),
      game(2, { offense_snaps: 10, offense_team_snaps: 40, penalties: 0 }),
    ])
    // 70 of 100 snaps - averaging 100% and 25% would say 62.5%.
    expect(totals).toMatchObject({ snaps: 70, snapPct: 70, pen: 1 })
  })
})

describe("kicker game log", () => {
  it("totals the long as the season's longest kick, and FG% from summed kicks", () => {
    const totals = gameLogConfigForPosition("K")!.toTotals([
      game(1, { fg_made: 2, fg_att: 2, fg_long: 48 }),
      game(2, { fg_made: 1, fg_att: 2, fg_long: 55, fg_made_50_59: 1 }),
    ])
    expect(totals).toMatchObject({ fgm: 3, fga: 4, fgPct: 75, long: 55, fg50: 1 })
  })
})

describe("defensive back game log", () => {
  it("adds up tackles and recomputes the season rating allowed from summed coverage", () => {
    const totals = gameLogConfigForPosition("CB")!.toTotals([
      game(1, { def_tackles_solo: 4, def_targets: 10, def_completions_allowed: 5, def_yards_allowed: 50 }),
      game(2, { def_tackle_assists: 2, def_targets: 10, def_completions_allowed: 5, def_yards_allowed: 50 }),
    ])
    // 10/20 for 100 yards, no TDs or INTs: (1.0 + 0.5 + 0 + 2.375) / 6 * 100.
    expect(totals).toMatchObject({ tkl: 6, tgt: 20, yardsAllowed: 100, ratingAllowed: 64.6 })
  })
})
