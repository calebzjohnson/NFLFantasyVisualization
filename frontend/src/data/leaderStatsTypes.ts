export interface LeaderColumn {
  key: string
  label: string
}

export interface DetailedLeaderRow {
  rank: number
  player: string
  team: string
  stats: Record<string, number>
}

