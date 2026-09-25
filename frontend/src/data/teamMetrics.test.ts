// teamMetrics.test.ts
// Tests for team season totals, per-game team metrics, and trending teams.
import { describe, expect, it } from "vitest"
import { teamInfo } from "../test/fixtures"
import { TEAM_METRICS, teamSeasonRows, trendingTeams, type TeamGameRow } from "./teamMetrics"

function game(team: string, weekNumber: number, stats: Record<string, number> = {}): TeamGameRow {
  return { team, week: weekNumber, game_id: `g${weekNumber}`, opponent_team: "OPP", ...stats }
}

function metric(key: string) {
  return TEAM_METRICS.find((m) => m.key === key)!
}

describe("teamSeasonRows", () => {
  const rows = teamSeasonRows(
    [
      game("BUF", 1, { points_for: 24, passing_yards: 300 }),
      game("BUF", 2, { points_for: 20, passing_yards: 200 }),
      game("MIA", 1, { points_for: 10 }),
    ],
    [teamInfo("BUF", { team_name: "Buffalo Bills" })],
  )
  const byTeam = new Map(rows.map((row) => [row.team, row]))

  it("sums numeric stats and counts games, without summing week or text fields", () => {
    expect(byTeam.get("BUF")).toMatchObject({ games: 2, points_for: 44, passing_yards: 500 })
    expect(byTeam.get("BUF")).not.toHaveProperty("week")
    expect(byTeam.get("BUF")).not.toHaveProperty("game_id")
  })

  it("attaches the name and resized logo, falling back to the abbreviation", () => {
    expect(byTeam.get("BUF")?.name).toBe("Buffalo Bills")
    expect(byTeam.get("BUF")?.logo).toContain("combiner")
    expect(byTeam.get("MIA")).toMatchObject({ name: "MIA", logo: "" })
  })
})

describe("TEAM_METRICS", () => {
  it("averages per game on a season row", () => {
    expect(metric("points").value({ games: 3, points_for: 70 })).toBe(23.3)
  })

  it("treats a single /teams/weekly row as one game", () => {
    expect(metric("points").value({ points_for: 27 })).toBe(27)
  })

  it("uses net passing yards (sack_yards_lost is negative) for yards gained and allowed", () => {
    const row = {
      games: 1,
      passing_yards: 250,
      sack_yards_lost: -20,
      rushing_yards: 100,
      passing_yards_allowed: 200,
      sack_yards_lost_allowed: -10,
      rushing_yards_allowed: 50,
    }
    expect(metric("yards").value(row)).toBe(330)
    expect(metric("pass_yards").value(row)).toBe(230)
    expect(metric("yards_allowed").value(row)).toBe(240)
  })

  it("counts interceptions plus fumbles as turnovers, and INTs plus recoveries as takeaways", () => {
    const row = { games: 1, passing_interceptions: 2, fumbles_lost_total: 1, def_interceptions: 1, fumble_recovery_opp: 2 }
    expect(metric("turnovers").value(row)).toBe(3)
    expect(metric("takeaways").value(row)).toBe(3)
  })

  it("has unique keys", () => {
    const keys = TEAM_METRICS.map((m) => m.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("trendingTeams", () => {
  it("uses each team's own last 5 games, in week order", () => {
    // Out of order on purpose; week 1 and 2 fall outside BUF's last 5 games.
    const games = [7, 3, 1, 5, 2, 6, 4].map((w) => game("BUF", w, { points_for: w <= 2 ? 99 : w * 3 }))

    const { up } = trendingTeams(games, metric("points"), [teamInfo("BUF", { team_name: "Buffalo Bills" })])

    expect(up).toHaveLength(1)
    expect(up[0]).toMatchObject({ id: "BUF", name: "Buffalo Bills" })
    expect(up[0].slope).toBeCloseTo(3)
    expect(up[0].games.map((g) => g.week)).toEqual([3, 4, 5, 6, 7])
    expect(up[0].logo).toContain("combiner")
  })

  it("needs at least 2 games to call it a trend", () => {
    const { up, down } = trendingTeams([game("BUF", 1, { points_for: 30 })], metric("points"), [])
    expect(up).toEqual([])
    expect(down).toEqual([])
  })

  it("puts falling teams in down", () => {
    const games = [1, 2, 3].map((w) => game("MIA", w, { points_for: 30 - w * 5 }))
    const { up, down } = trendingTeams(games, metric("points"), [])
    expect(up).toEqual([])
    expect(down.map((l) => l.id)).toEqual(["MIA"])
  })
})
