// leaderStatsTypes.ts
// Types for Stat Leaders table columns and rows.
export interface LeaderColumn {
  key: string
  label: string
  tone?: "positive" | "negative"
}

export interface DetailedLeaderRow {
  rank: number
  playerId: string
  player: string
  team: string
  stats: Record<string, number>
}

