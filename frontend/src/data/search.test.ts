// search.test.ts
// Tests for search matching and which players/teams each search scope returns.
import { describe, expect, it } from "vitest"
import { teamInfo } from "../test/fixtures"
import { matchesQuery, searchResults, type SearchPlayer } from "./search"

function player(name: string): SearchPlayer {
  return { player_id: name, player_display_name: name, recent_team: "BUF", position: "QB" }
}

const teams = [
  teamInfo("KC", { team_name: "Kansas City Chiefs" }),
  teamInfo("LA", { team_name: "Los Angeles Rams" }),
  teamInfo("LAC", { team_name: "Los Angeles Chargers" }),
  teamInfo("BUF", { team_name: "Buffalo Bills" }),
]

describe("matchesQuery", () => {
  it("prefix-matches each typed word against any word in the name", () => {
    expect(matchesQuery("Joshua Farmer", "josh farm")).toBe(true)
    expect(matchesQuery("Joshua Farmer", "farmer")).toBe(true)
  })

  it("rejects a word that doesn't start any name word", () => {
    expect(matchesQuery("Joshua Farmer", "arm")).toBe(false)
  })
})

describe("searchResults", () => {
  const players = [player("Josh Allen"), player("Josh Downs"), { ...player(""), player_display_name: null }]

  it("returns nothing for a blank query", () => {
    expect(searchResults("   ", "all", players, teams)).toEqual({ teams: [], players: [] })
  })

  it("finds teams by name or abbreviation", () => {
    expect(searchResults("chiefs", "teams", null, teams).teams.map((t) => t.team_abbr)).toEqual(["KC"])
    expect(searchResults("kc", "teams", null, teams).teams.map((t) => t.team_abbr)).toEqual(["KC"])
    expect(searchResults("los angeles", "teams", null, teams).teams).toHaveLength(2)
  })

  it("keeps each scope to its own kind of result", () => {
    expect(searchResults("b", "players", players, teams).teams).toEqual([])
    expect(searchResults("josh", "teams", players, teams).players).toEqual([])
  })

  it("returns both kinds for an all search, skipping nameless rows", () => {
    const results = searchResults("b", "all", [player("Bo Nix"), ...players], teams)
    expect(results.teams.map((t) => t.team_abbr)).toEqual(["BUF"])
    expect(results.players.map((p) => p.player_display_name)).toEqual(["Bo Nix"])
  })

  it("caps an all search at 8, with at most 3 teams", () => {
    const manyTeams = Array.from({ length: 6 }, (_, i) => teamInfo(`T${i}`, { team_name: `Tigers ${i}` }))
    const manyPlayers = Array.from({ length: 10 }, (_, i) => player(`Tim ${i}`))
    const results = searchResults("t", "all", manyPlayers, manyTeams)

    expect(results.teams).toHaveLength(3)
    expect(results.players).toHaveLength(5)
  })

  it("works before the lists have loaded", () => {
    expect(searchResults("josh", "all", null, null)).toEqual({ teams: [], players: [] })
  })
})
