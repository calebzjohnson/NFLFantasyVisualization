// teamMetrics.ts
// Team stat catalog (offense and defense, per game) for the Teams page, plus
// season rows and trending-team lines built from /teams/weekly.
import { perAttempt } from "../lib/footballStats"
import { teamLogoUrl } from "../lib/imageUrls"
import { num, type PlayerMetric, type StatFields } from "./playerMetrics"
import type { TeamInfo } from "./teams"
import { slope, topTrends, type TrendLine } from "./trendingPlayers"

// One row from /teams/weekly: one team's stats in one game. Opponent's stats
// in that game carry an "_allowed" suffix; the score is points_for/against.
export type TeamGameRow = StatFields & { team: string; week: number }

// One team's season: every numeric stat summed, plus games played, name, and logo.
export type TeamSeasonRow = StatFields & { team: string; games: number; name: string; logo: string }

export const TEAM_SIDES = ["Offense", "Defense"] as const
export type TeamSide = (typeof TEAM_SIDES)[number]

export interface TeamMetric extends PlayerMetric {
  side: TeamSide
  short: string // Team Leaders column header
  lowerIsBetter?: boolean // sorts ascending first, e.g. points allowed
}

// Per-game average. A /teams/weekly row has no `games` field - it's one game -
// so the same metric works on a season row and on a single game for trends.
function perGame(row: StatFields, total: number): number {
  return perAttempt(total, Number(row.games ?? 1))
}

// Official (net) passing yards: nflverse's passing_yards doesn't subtract
// sacks, and sack_yards_lost is already negative.
function netPassingYards(row: StatFields, suffix = ""): number {
  return num(row, `passing_yards${suffix}`) + num(row, `sack_yards_lost${suffix}`)
}

export const TEAM_METRICS: TeamMetric[] = [
  {
    side: "Offense",
    key: "points",
    label: "Points / Game",
    short: "PTS",
    value: (row) => perGame(row, num(row, "points_for")),
  },
  {
    side: "Offense",
    key: "yards",
    label: "Yards / Game",
    short: "YDS",
    value: (row) => perGame(row, netPassingYards(row) + num(row, "rushing_yards")),
  },
  {
    side: "Offense",
    key: "pass_yards",
    label: "Passing Yards / Game",
    short: "PASS YDS",
    value: (row) => perGame(row, netPassingYards(row)),
  },
  {
    side: "Offense",
    key: "rush_yards",
    label: "Rushing Yards / Game",
    short: "RUSH YDS",
    value: (row) => perGame(row, num(row, "rushing_yards")),
  },
  {
    side: "Offense",
    key: "ypc",
    label: "Yards / Carry",
    short: "YPC",
    value: (row) => perAttempt(num(row, "rushing_yards"), num(row, "carries")),
  },
  {
    side: "Offense",
    key: "completion_pct",
    label: "Completion %",
    short: "CMP%",
    unit: "%",
    value: (row) => perAttempt(num(row, "completions") * 100, num(row, "attempts")),
  },
  {
    side: "Offense",
    key: "turnovers",
    label: "Turnovers / Game",
    short: "TO",
    lowerIsBetter: true,
    value: (row) => perGame(row, num(row, "passing_interceptions") + num(row, "fumbles_lost_total")),
  },
  {
    side: "Offense",
    key: "sacks_taken",
    label: "Sacks Taken / Game",
    short: "SCK",
    lowerIsBetter: true,
    value: (row) => perGame(row, num(row, "sacks_suffered")),
  },
  {
    side: "Defense",
    key: "points_allowed",
    label: "Points Allowed / Game",
    short: "PTS",
    lowerIsBetter: true,
    value: (row) => perGame(row, num(row, "points_against")),
  },
  {
    side: "Defense",
    key: "yards_allowed",
    label: "Yards Allowed / Game",
    short: "YDS",
    lowerIsBetter: true,
    value: (row) => perGame(row, netPassingYards(row, "_allowed") + num(row, "rushing_yards_allowed")),
  },
  {
    side: "Defense",
    key: "pass_yards_allowed",
    label: "Passing Yards Allowed / Game",
    short: "PASS YDS",
    lowerIsBetter: true,
    value: (row) => perGame(row, netPassingYards(row, "_allowed")),
  },
  {
    side: "Defense",
    key: "rush_yards_allowed",
    label: "Rushing Yards Allowed / Game",
    short: "RUSH YDS",
    lowerIsBetter: true,
    value: (row) => perGame(row, num(row, "rushing_yards_allowed")),
  },
  {
    side: "Defense",
    key: "sacks",
    label: "Sacks / Game",
    short: "SCK",
    value: (row) => perGame(row, num(row, "def_sacks")),
  },
  {
    side: "Defense",
    key: "takeaways",
    label: "Takeaways / Game",
    short: "TKWY",
    value: (row) => perGame(row, num(row, "def_interceptions") + num(row, "fumble_recovery_opp")),
  },
]

// Sums each team's games into one season row (per-game metrics divide by
// `games`, so teams with an extra bye compare fairly).
export function teamSeasonRows(games: TeamGameRow[], teams: TeamInfo[]): TeamSeasonRow[] {
  const infoByTeam = new Map(teams.map((team) => [team.team_abbr, team]))
  const byTeam = new Map<string, TeamSeasonRow>()
  for (const game of games) {
    const info = infoByTeam.get(game.team)
    const season = byTeam.get(game.team) ?? {
      team: game.team,
      games: 0,
      name: info?.team_name ?? game.team,
      logo: info ? teamLogoUrl(info.team_logo_espn) : "",
    }
    season.games += 1
    for (const [field, value] of Object.entries(game)) {
      if (typeof value === "number" && field !== "week") season[field] = num(season, field) + value
    }
    byTeam.set(game.team, season)
  }
  return [...byTeam.values()]
}

// Each team's own last TREND_GAMES games (so byes don't shorten anyone's
// window), scored by slope. No involvement floor like players need - every
// team plays every snap of its own games.
const TREND_GAMES = 5
const MIN_GAMES = 2

export function trendingTeams(
  games: TeamGameRow[],
  metric: PlayerMetric,
  teams: TeamInfo[],
): { up: TrendLine[]; down: TrendLine[] } {
  const infoByTeam = new Map(teams.map((team) => [team.team_abbr, team]))
  const byTeam = new Map<string, TeamGameRow[]>()
  for (const game of games) {
    const teamGames = byTeam.get(game.team) ?? []
    teamGames.push(game)
    byTeam.set(game.team, teamGames)
  }

  const lines: TrendLine[] = []
  for (const [team, teamGames] of byTeam) {
    if (teamGames.length < MIN_GAMES) continue
    const recent = [...teamGames].sort((a, b) => a.week - b.week).slice(-TREND_GAMES)
    const points = recent.map((game) => ({ x: game.week, y: metric.value(game) }))
    const info = infoByTeam.get(team)
    lines.push({
      id: team,
      name: info?.team_name ?? team,
      team,
      headshot: null,
      logo: info && teamLogoUrl(info.team_logo_espn),
      slope: slope(points),
      games: points.map((p) => ({ week: p.x, value: p.y })),
    })
  }
  return topTrends(lines)
}
