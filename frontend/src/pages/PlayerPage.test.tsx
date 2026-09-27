// PlayerPage.test.tsx
// Tests that the player page only shows radar/usage/league panels for positions that have them.
import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { playerBio, teamInfo } from "../test/fixtures"
import { mockApi, renderWithRouter } from "../test/render"
import PlayerPage from "./PlayerPage"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

function renderPlayer(playerId: string, position: string) {
  mockApi({
    "/teams": [teamInfo("KC")],
    [`/players/${playerId}/bio`]: playerBio({ player_id: playerId, display_name: `${position} Player`, position }),
    [`/players/${playerId}/games`]: [],
  })
  renderWithRouter(<PlayerPage />, { route: `/players/${playerId}`, path: "/players/:playerId" })
}

describe("PlayerPage", () => {
  it.each([
    ["O1", "OT"],
    ["K1", "K"],
    ["P1", "P"],
  ])("shows only the game log for a %s (%s)", async (playerId, position) => {
    renderPlayer(playerId, position)

    expect(await screen.findByText("Game Log")).toBeInTheDocument()
    expect(screen.queryByText("Player Breakdown")).not.toBeInTheDocument()
    expect(screen.queryByText("League Comparison")).not.toBeInTheDocument()
  })

  it("shows the radar and league comparison for a defender", async () => {
    renderPlayer("D1", "CB")

    expect(await screen.findByText("Player Breakdown")).toBeInTheDocument()
    expect(screen.getByText("League Comparison")).toBeInTheDocument()
  })
})
