export interface TeamRecord {
  team: string
  wins: number
  losses: number
  ties: number
  points_for: number
  points_against: number
  win_pct: number
}

export interface DivisionStanding {
  division: string
  teams: TeamRecord[]
}

export function formatPct(winPct: number): string {
  const formatted = winPct.toFixed(3)
  return formatted.startsWith("0.") ? formatted.slice(1) : formatted
}
