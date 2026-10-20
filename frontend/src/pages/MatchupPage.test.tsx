// MatchupPage.test.tsx
// Tests the one-game route: a scheduled game gets the preview, a final game
// gets the breakdown, and never both.
import { fireEvent, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { mockApi, renderWithRouter } from "../test/render"
import MatchupPage from "./MatchupPage"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

function unit(epa: number) {
  const rate = { plays: 10, epa: epa * 10, epa_per_play: epa, success_rate: 45 }
  return { plays: 30, overall: rate, pass: rate, run: rate }
}

function gameTeam(team: string, epa: number, yards: number, extra: Record<string, number>) {
  return {
    team,
    offense: unit(epa),
    defense: unit(0),
    plays: 60,
    yards,
    pass_yards: 220,
    pass_plays: 35,
    rush_yards: 90,
    rush_plays: 25,
    first_downs: 20,
    interceptions: 1,
    fumbles_lost: 0,
    turnovers: 1,
    sacks: 2,
    pressures: 10,
    penalties: 5,
    penalty_yards: 40,
    time_of_possession: 1800,
    third_down_attempts: 12,
    third_down_conversions: 5,
    ...extra,
  }
}

const game = {
  game_id: "2026_01_DAL_NYG",
  week: 1,
  gameday: "2026-09-13",
  weekday: "Sunday",
  gametime: "20:20",
  away_team: "DAL",
  home_team: "NYG",
  away_score: null,
  home_score: null,
  away_rest: 7,
  home_rest: 7,
  div_game: 1,
  roof: "outdoors",
  surface: "grass",
  away_qb_name: "Away QB",
  home_qb_name: "Home QB",
  stadium: "The Stadium",
}

const scheduled = {
  status: "scheduled",
  game,
  preview: {
    teams: [
      {
        ...gameTeam("DAL", 0.2, 340, {}),
        games: 6,
        defense: unit(-0.1),
        form: [
          { game_id: "2026_06_PHI_DAL", week: 6, opponent: "PHI", home: true, points_for: 24, points_against: 17, result: "W" },
          { game_id: "2026_05_DAL_WAS", week: 5, opponent: "WAS", home: false, points_for: 10, points_against: 27, result: "L" },
        ],
      },
      {
        ...gameTeam("NYG", 0.05, 310, {}),
        games: 6,
        defense: unit(0.08),
        form: [
          { game_id: "2026_06_DAL_NYG", week: 6, opponent: "DAL", home: true, points_for: 20, points_against: 20, result: "T" },
        ],
      },
    ],
    leaders: [
      {
        key: "passing_yards",
        label: "Pass Yards",
        leaders: [
          { team: "DAL", player_id: "Q1", name: "Q One", position: "QB", headshot_url: null, value: 245.5 },
          { team: "NYG", player_id: "Q2", name: "Q Two", position: "QB", headshot_url: null, value: 230.1 },
        ],
      },
    ],
  },
}

// Its own game_id: useFetch caches per path for the whole test file, so a
// second payload at the same path would never be fetched.
const final = {
  status: "final",
  game: { ...game, game_id: "2026_02_DAL_NYG", away_score: 20, home_score: 28 },
  breakdown: {
    teams: [
      gameTeam("DAL", 0.1, 310, { turnovers: 2, penalty_yards: 45, third_down_conversions: 4 }),
      gameTeam("NYG", 0.25, 402, { turnovers: 0, penalty_yards: 30, third_down_conversions: 7 }),
    ],
    line_score: [
      { quarter: 1, away: 7, home: 14 },
      { quarter: 2, away: 13, home: 14 },
    ],
    drives: [
      { drive: 1, team: "DAL", quarter: 1, result: "Punt", plays: 5, yards: 12 },
      { drive: 2, team: "NYG", quarter: 1, result: "Touchdown", plays: 9, yards: 75 },
    ],
    win_probability: [
      { elapsed: 0, quarter: 1, home_wp: 55 },
      { elapsed: 3600, quarter: 4, home_wp: 100 },
    ],
    leaders: [
      {
        key: "passing_yards",
        label: "Pass Yards",
        leaders: [
          { team: "DAL", player_id: "Q1", name: "Q One", value: 300 },
          { team: "NYG", player_id: "Q2", name: "Q Two", value: 250 },
        ],
      },
    ],
    box_score: [
      {
        team: "DAL",
        passing: [{ player_id: "Q1", name: "Q One", position: "QB", passing_yards: 300 }],
        rushing: [],
        receiving: [],
        defense: [],
      },
      { team: "NYG", passing: [], rushing: [], receiving: [], defense: [] },
    ],
  },
}

const standings = [
  {
    division: "NFC East",
    teams: [
      { team: "DAL", wins: 3, losses: 2, ties: 0 },
      { team: "NYG", wins: 1, losses: 4, ties: 0 },
    ],
  },
]

function renderMatchup(payload: Record<string, unknown> & { game: { game_id: string } }) {
  const id = payload.game.game_id
  mockApi({ [`/matchups/${id}`]: payload, "/teams": [], "/standings": standings })
  renderWithRouter(<MatchupPage />, { route: `/matchups/${id}`, path: "/matchups/:gameId" })
}

describe("MatchupPage", () => {
  it("previews a game that hasn't been played", async () => {
    renderMatchup(scheduled)

    expect(await screen.findByRole("heading", { name: "The Matchup" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Season Comparison" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Season Leaders" })).toBeInTheDocument()
    // A preview has no result to break down.
    expect(screen.queryByRole("heading", { name: "Win Probability" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Drives" })).not.toBeInTheDocument()
  })

  it("says the comparison is per game", async () => {
    renderMatchup(scheduled)

    // Both the comparison and the leaders say so, each about its own numbers.
    expect(await screen.findAllByText(/Per game averages this season/)).toHaveLength(2)
  })

  it("carries each team's recent results in the header, not a panel of their own", async () => {
    renderMatchup(scheduled)

    await screen.findByRole("heading", { name: "The Matchup" })
    expect(screen.queryByRole("heading", { name: "Last Three" })).not.toBeInTheDocument()
    // A letter as well as a colour, with the score alongside it for hover
    // and read out for anyone not hovering.
    expect(screen.getByText(/week 6, 24 to 17 against PHI/)).toBeInTheDocument()
    expect(screen.getByText("W 24-17")).toBeInTheDocument()
    expect(screen.getByText("at WAS")).toBeInTheDocument()
    // Each result links to its own recap.
    expect(screen.getByRole("link", { name: /week 6, 24 to 17 against PHI/ })).toHaveAttribute(
      "href",
      "/matchups/2026_06_PHI_DAL",
    )
  })

  it("pairs each offense with the opposing defense", async () => {
    renderMatchup(scheduled)

    expect(
      await screen.findByRole("heading", { name: "DAL offense vs NYG defense" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "NYG offense vs DAL defense" })).toBeInTheDocument()
  })

  it("breaks down a game that's final", async () => {
    renderMatchup(final)

    expect(await screen.findByRole("heading", { name: "Team Comparison" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Drives" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Preview" })).not.toBeInTheDocument()
  })

  it("puts both teams' numbers either side of the stat they measure", async () => {
    renderMatchup(final)

    const row = (await screen.findByText("Yards")).closest("div")?.parentElement
    expect(row).not.toBeNull()
    expect(row).toHaveTextContent("310")
    expect(row).toHaveTextContent("402")
  })

  it("opens on the gist and expands to the rest", async () => {
    renderMatchup(final)

    const expand = await screen.findByRole("button", { name: "Show every team stat" })
    expect(screen.queryByText("Penalty Yards")).not.toBeInTheDocument()
    // The group headings are the dividers, and they only appear expanded.
    expect(screen.queryByRole("heading", { name: "Discipline" })).not.toBeInTheDocument()

    fireEvent.click(expand)

    const full = screen.getByRole("dialog")
    expect(within(full).getByText("Penalty Yards")).toBeInTheDocument()
    expect(within(full).getByRole("heading", { name: "Discipline" })).toBeInTheDocument()
  })

  it("names the game's leaders a side", async () => {
    renderMatchup(final)

    const panel = (await screen.findByRole("heading", { name: "Game Leaders" })).closest("section")
    expect(panel).not.toBeNull()
    expect(within(panel as HTMLElement).getByText("Pass Yards")).toBeInTheDocument()
    expect(within(panel as HTMLElement).getByRole("link", { name: "Q One" })).toHaveAttribute(
      "href",
      "/players/Q1",
    )
  })

  it("says why pressures are missing rather than letting it read as none", async () => {
    renderMatchup({
      ...final,
      game: { ...final.game, game_id: "2026_04_DAL_NYG" },
      breakdown: {
        ...final.breakdown,
        teams: final.breakdown.teams.map((team) => ({ ...team, pressures: null })),
      },
    })

    expect(await screen.findByText(/Pro Football Reference/)).toBeInTheDocument()
  })

  it("leaves the note off once the pressures are in", async () => {
    renderMatchup(final)

    await screen.findByRole("heading", { name: "Game Leaders" })
    expect(screen.queryByText(/Pro Football Reference/)).not.toBeInTheDocument()
  })

  it("keeps the box score on its own tab", async () => {
    renderMatchup(final)

    const tab = await screen.findByRole("button", { name: "Box Score" })
    expect(screen.queryByRole("heading", { name: /Box Score$/ })).not.toBeInTheDocument()

    fireEvent.click(tab)

    expect(await screen.findByRole("heading", { name: "DAL Box Score" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Team Comparison" })).not.toBeInTheDocument()
  })

  it("shows the drives as a chart first, with the list behind a toggle", async () => {
    renderMatchup(final)

    const toggle = await screen.findByRole("button", { name: "Show list" })
    // The chart is the opening view, so no drive rows are listed yet.
    expect(screen.queryByText(/plays,/)).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(screen.getByText("Touchdown")).toBeInTheDocument()
    expect(screen.getByText("Punt")).toBeInTheDocument()
    expect(screen.getByText("5 plays, 12 yards")).toBeInTheDocument()
  })

  it("scores the game by quarter between the two teams", async () => {
    renderMatchup(final)

    const line = await screen.findByRole("table", { name: /Scoring by quarter/i })
    expect(within(line).getByRole("columnheader", { name: "Q1" })).toBeInTheDocument()
    // Each side's own row, named so the numbers aren't anonymous.
    expect(within(line).getByRole("rowheader", { name: "DAL" })).toBeInTheDocument()
    expect(within(line).getByRole("rowheader", { name: "NYG" })).toBeInTheDocument()
  })

  it("carries each team's record", async () => {
    renderMatchup(final)

    expect(await screen.findByText("3-2")).toBeInTheDocument()
    expect(screen.getByText("1-4")).toBeInTheDocument()
  })

  it("says Final/OT when the game ran past four quarters", async () => {
    renderMatchup({
      ...final,
      game: { ...final.game, game_id: "2026_03_DAL_NYG" },
      breakdown: {
        ...final.breakdown,
        line_score: [...final.breakdown.line_score, { quarter: 5, away: 0, home: 3 }],
      },
    })

    expect(await screen.findByText("Final/OT")).toBeInTheDocument()
  })

  it("reports a failed load", async () => {
    mockApi({ "/teams": [] })
    renderWithRouter(<MatchupPage />, { route: "/matchups/nope", path: "/matchups/:gameId" })

    expect(await screen.findByText(/Couldn't load matchup/)).toBeInTheDocument()
  })
})
