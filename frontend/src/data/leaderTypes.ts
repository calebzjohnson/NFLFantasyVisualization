export interface LeaderRow {
  rank: number
  player: string
  team: string
  value: number
}

export interface LeaderCategory {
  title: string
  unit: string
  rows: LeaderRow[]
}
