// leaderStatsTypes.ts
// Types for Stat Leaders table columns and rows.
export interface LeaderColumn {
  key: string
  label: string
  tone?: "positive" | "negative"
}

// What DetailedLeaderTable itself needs from a row; callers extend it with
// whatever their name cell renders.
export interface LeaderRow {
  rank: number
  stats: Record<string, number>
}

export interface DetailedLeaderRow extends LeaderRow {
  playerId: string
  player: string
  team: string
  headshot: string | null
  teamColor: string
}

