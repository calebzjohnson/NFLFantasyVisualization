// scores.ts
// GameScore type for /scores plus kickoff formatting and sort helpers.
// The /scores response has many more fields (betting lines, weather, rosters, etc.)
// than this — only declaring the ones the UI actually reads.
export interface GameScore {
  game_id: string
  week: number
  gameday: string
  weekday: string
  gametime: string
  away_team: string
  away_score: number
  home_team: string
  home_score: number
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
