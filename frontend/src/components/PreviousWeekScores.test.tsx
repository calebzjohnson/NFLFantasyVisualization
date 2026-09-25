// PreviousWeekScores.test.tsx
// Tests for the scoreboard: games, team page links, and teams on bye.
import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { GameScore } from "../data/scores"
import { teamInfo } from "../test/fixtures"
import { mockApi, renderWithRouter } from "../test/render"
import PreviousWeekScores from "./PreviousWeekScores"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

const game: GameScore = {
  game_id: "2026_01_MIA_BUF",
  game_type: "REG",
  week: 1,
  gameday: "2026-09-13",
  weekday: "Sunday",
  gametime: "13:00",
  away_team: "MIA",
  away_score: 10,
  home_team: "BUF",
  home_score: 24,
  status: "final",
}

describe("PreviousWeekScores", () => {
  beforeEach(() => {
    mockApi({ "/scores": [game], "/teams": [teamInfo("BUF"), teamInfo("MIA"), teamInfo("KC")] })
  })

  it("shows each game's teams and scores, linked to their team pages", async () => {
    renderWithRouter(<PreviousWeekScores />)

    expect(await screen.findByRole("link", { name: "BUF" })).toHaveAttribute("href", "/teams/BUF")
    expect(screen.getByRole("link", { name: "MIA" })).toHaveAttribute("href", "/teams/MIA")
    expect(screen.getByText("24")).toBeInTheDocument()
    expect(screen.getByText("Week 1")).toBeInTheDocument()
  })

  it("lists teams without a game as on bye, also linked", async () => {
    renderWithRouter(<PreviousWeekScores />)

    expect(await screen.findByText("Bye")).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "KC" })).toHaveAttribute("href", "/teams/KC")
  })
})
