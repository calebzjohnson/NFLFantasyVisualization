// scores.ts
// GameScore type for /scores plus kickoff formatting, sort, and bye-week helpers.
// The /scores response has many more fields (betting lines, weather, rosters, etc.)
// than this — only declaring the ones the UI actually reads.
import type { TeamInfo } from "./teams"

export interface GameScore {
  game_id: string
  game_type: string
  week: number
  gameday: string
  weekday: string
  gametime: string
  away_team: string
  away_score: number | null
  home_team: string
  home_score: number | null
  status: "final" | "scheduled"
}

export function formatKickoff(game: GameScore): string {
  const time = new Date(`2000-01-01T${game.gametime}:00`).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
  return `${game.weekday.slice(0, 3)} ${time}`
}

export function byKickoff(a: GameScore, b: GameScore): number {
  return a.gameday.localeCompare(b.gameday) || a.gametime.localeCompare(b.gametime)
}

// A full regular-season slate: 32 teams, 16 games.
export const SLATE_ROWS = 16

// Regular-season slates (as opposed to playoff rounds, where "not playing"
// means eliminated rather than on bye).
export function isRegularSeasonSlate(games: GameScore[]): boolean {
  return games.length > 0 && games.every((game) => game.game_type === "REG")
}

// Teams with no game in a regular-season week are on bye.
export function byeTeams(games: GameScore[], teams: TeamInfo[]): string[] {
  if (!isRegularSeasonSlate(games)) return []

  const playing = new Set(games.flatMap((game) => [game.away_team, game.home_team]))
  return teams
    .map((team) => team.team_abbr)
    .filter((abbr) => !playing.has(abbr))
    .sort()
}
