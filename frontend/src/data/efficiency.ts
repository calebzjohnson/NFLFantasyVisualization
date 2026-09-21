// efficiency.ts
// Type for /teams/efficiency, plus the join with /teams and the math the
// offense-vs-defense scatter needs.
import type { TeamInfo } from "./teams"

export interface TeamEfficiency {
  team: string
  offensive_epa_per_play: number | null
  offensive_plays: number | null
  defensive_epa_per_play: number | null
  defensive_plays: number | null
}

export interface TeamPoint {
  team: string
  name: string
  logo: string
  offense: number // EPA per play gained on offense (higher is better)
  defense: number // EPA per play allowed on defense (lower is better)
  offensePlays: number
  defensePlays: number
}

export function toTeamPoints(efficiency: TeamEfficiency[], teams: TeamInfo[]): TeamPoint[] {
  const infoByAbbr = new Map(teams.map((team) => [team.team_abbr, team]))
  const points: TeamPoint[] = []

  for (const row of efficiency) {
    const info = infoByAbbr.get(row.team)
    if (
      !info ||
      row.offensive_epa_per_play === null ||
      row.defensive_epa_per_play === null ||
      row.offensive_plays === null ||
      row.defensive_plays === null
    ) {
      continue
    }
    points.push({
      team: row.team,
      name: info.team_name,
      logo: info.team_logo_espn,
      offense: row.offensive_epa_per_play,
      defense: row.defensive_epa_per_play,
      offensePlays: row.offensive_plays,
      defensePlays: row.defensive_plays,
    })
  }
  return points
}

// League average EPA/play, weighted by play count (each team's plays count in
// proportion to how many it ran / faced).
export function leagueAverages(points: TeamPoint[]): { offense: number; defense: number } {
  const offensePlays = points.reduce((sum, p) => sum + p.offensePlays, 0)
  const defensePlays = points.reduce((sum, p) => sum + p.defensePlays, 0)
  return {
    offense: points.reduce((sum, p) => sum + p.offense * p.offensePlays, 0) / offensePlays,
    defense: points.reduce((sum, p) => sum + p.defense * p.defensePlays, 0) / defensePlays,
  }
}

// Signed, two-decimal EPA with a true minus sign, e.g. "+0.37", "−0.13".
export function formatEpa(value: number): string {
  const rounded = Math.abs(value).toFixed(2)
  if (Number(rounded) === 0) return "0.00"
  return `${value > 0 ? "+" : "−"}${rounded}`
}
