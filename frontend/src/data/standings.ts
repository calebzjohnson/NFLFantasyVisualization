// standings.ts
// Types for /standings plus record/win-percentage formatting and a one-team lookup.
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

// "2-1", or "2-1-1" once a team has a tie.
export function formatRecord(record: TeamRecord): string {
  const base = `${record.wins}-${record.losses}`
  return record.ties > 0 ? `${base}-${record.ties}` : base
}

// A team's record and 1-based place in its division, or null if it's not in the standings.
export function findTeamStanding(
  standings: DivisionStanding[],
  team: string,
): { record: TeamRecord; division: string; place: number } | null {
  for (const division of standings) {
    const index = division.teams.findIndex((record) => record.team === team)
    if (index !== -1) return { record: division.teams[index], division: division.division, place: index + 1 }
  }
  return null
}
