// teams.ts
// Type for /teams (only the fields the UI reads), a team -> resized logo lookup, and team page URLs.
import { teamLogoUrl } from "../lib/imageUrls"

export interface TeamInfo {
  team_abbr: string
  team_name: string
  team_logo_espn: string
  team_color: string
}

export function teamPath(abbr: string): string {
  return `/teams/${encodeURIComponent(abbr)}`
}

// Abbreviation -> CDN-resized logo URL, for panels that only have a team's abbreviation.
export function logoByTeam(teams: TeamInfo[] | null): Map<string, string> {
  return new Map(teams?.map((team) => [team.team_abbr, teamLogoUrl(team.team_logo_espn)]))
}
