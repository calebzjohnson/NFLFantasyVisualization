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

export interface DetailedLeaderCategory {
  key: string
  label: string
  columns: LeaderColumn[]
  rows: DetailedLeaderRow[]
}
