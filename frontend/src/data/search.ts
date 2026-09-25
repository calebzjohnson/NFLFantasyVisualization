// search.ts
// Search matching for the search bars: which players and teams match a typed query.
import type { TeamInfo } from "./teams"

// nflverse's player-stats table includes a stray aggregate row with every
// field null - fields are optional here so the filter below can skip it.
export interface SearchPlayer {
  player_id: string | null
  player_display_name: string | null
  recent_team: string | null
  position: string | null
}

export type SearchScope = "players" | "teams" | "all"

const MAX_RESULTS = 8
// In an "all" search, teams go first but can't crowd out players.
const MAX_TEAMS_IN_ALL = 3

// Whole-string substring matching breaks on "Josh Farmer" vs "Joshua Farmer" -
// the extra letters in "Joshua" push the second word out of alignment. Instead,
// each typed word just needs to prefix-match some word in the name, so first
// or last name (or a shortened first name) all still find the player.
export function matchesQuery(name: string, query: string): boolean {
  const nameWords = name.toLowerCase().split(/\s+/)
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean)
  return queryWords.every((queryWord) => nameWords.some((nameWord) => nameWord.startsWith(queryWord)))
}

// Teams match on full name or abbreviation ("chiefs", "kansas", "KC").
export function searchResults(
  query: string,
  scope: SearchScope,
  players: SearchPlayer[] | null,
  teams: TeamInfo[] | null,
): { teams: TeamInfo[]; players: SearchPlayer[] } {
  const trimmed = query.trim()
  if (trimmed.length === 0) return { teams: [], players: [] }

  const teamMatches =
    scope === "players"
      ? []
      : (teams ?? [])
          .filter((team) => matchesQuery(`${team.team_name} ${team.team_abbr}`, trimmed))
          .slice(0, scope === "all" ? MAX_TEAMS_IN_ALL : MAX_RESULTS)
  const playerMatches =
    scope === "teams"
      ? []
      : (players ?? [])
          .filter((player) => player.player_display_name && matchesQuery(player.player_display_name, trimmed))
          .slice(0, MAX_RESULTS - teamMatches.length)

  return { teams: teamMatches, players: playerMatches }
}
