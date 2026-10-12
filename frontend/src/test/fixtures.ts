// fixtures.ts
// Shared test data builders; add new ones here as tests need them.
import type { DepthChartResponse } from "../data/depthChart"
import type { PlayerBio } from "../data/playerBio"
import type { TeamRecord } from "../data/standings"
import type { TeamInfo } from "../data/teams"

export function teamInfo(abbr: string, overrides: Partial<TeamInfo> = {}): TeamInfo {
  return {
    team_abbr: abbr,
    team_name: `${abbr} Team`,
    team_logo_espn: `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`,
    team_color: "#123456",
    team_color2: "#654321",
    ...overrides,
  }
}

export function teamRecord(team: string, overrides: Partial<TeamRecord> = {}): TeamRecord {
  return { team, wins: 0, losses: 0, ties: 0, points_for: 0, points_against: 0, win_pct: 0, previous_place: null, ...overrides }
}

export function depthChart(overrides: Partial<DepthChartResponse> = {}): DepthChartResponse {
  return {
    team: "BUF",
    scheme: "Base 4-3 D",
    groups: [
      {
        key: "offense",
        label: "3WR 1TE",
        slots: [
          {
            slot: 9,
            position: "QB",
            position_name: "Quarterback",
            players: [
              { player_id: "Q1", name: "Q One", rank: 1, status: null, injury: null },
              { player_id: "Q2", name: "Q Two", rank: 2, status: "IR", injury: null },
            ],
          },
          {
            slot: 1,
            position: "WR",
            position_name: "Wide Receiver",
            players: [
              { player_id: "W1", name: "W One", rank: 1, status: "QUESTIONABLE", injury: "Knee" },
            ],
          },
        ],
      },
    ],
    report: [
      {
        player_id: "Q2",
        name: "Q Two",
        position: "QB",
        status: "IR",
        injury: null,
        practice_status: null,
      },
      {
        player_id: "W1",
        name: "W One",
        position: "WR",
        status: "QUESTIONABLE",
        injury: "Knee",
        practice_status: "Limited Participation",
      },
    ],
    ...overrides,
  }
}

export function playerBio(overrides: Partial<PlayerBio> = {}): PlayerBio {
  return {
    player_id: "P1",
    display_name: "Player One",
    position: "QB",
    position_group: "QB",
    team: "KC",
    jersey_number: null,
    height_in: null,
    weight_lb: null,
    birth_date: null,
    college: null,
    status: null,
    draft_year: null,
    draft_round: null,
    draft_pick: null,
    draft_team: null,
    headshot_url: null,
    ...overrides,
  }
}
