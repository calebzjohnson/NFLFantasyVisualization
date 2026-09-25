// fixtures.ts
// Shared test data builders; add new ones here as tests need them.
import type { TeamRecord } from "../data/standings"
import type { TeamInfo } from "../data/teams"

export function teamInfo(abbr: string, overrides: Partial<TeamInfo> = {}): TeamInfo {
  return {
    team_abbr: abbr,
    team_name: `${abbr} Team`,
    team_logo_espn: `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`,
    team_color: "#123456",
    ...overrides,
  }
}

export function teamRecord(team: string, overrides: Partial<TeamRecord> = {}): TeamRecord {
  return { team, wins: 0, losses: 0, ties: 0, points_for: 0, points_against: 0, win_pct: 0, ...overrides }
}
