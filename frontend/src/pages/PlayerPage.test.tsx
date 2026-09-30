// PlayerPage.test.tsx
// Tests that the player page only shows radar/usage/league panels for positions that have them.
import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { fetchJson } from "../lib/api"
import { playerBio, teamInfo } from "../test/fixtures"
import { mockApi, renderWithRouter } from "../test/render"
import PlayerPage from "./PlayerPage"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

const dbPool = {
  position: "DB",
  axes: [{ key: "ball_production", label: "Ball Prod." }],
  players: [
    {
      player_id: "D1",
      name: "CB Player",
      team: "KC",
      axes: [{ key: "ball_production", label: "Ball Prod.", value: 12.5, percentile: 90 }],
    },
  ],
}

function renderPlayer(playerId: string, position: string) {
  mockApi({
    "/teams": [teamInfo("KC")],
    "/players/radar-pool?position=DB": dbPool,
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
    // The glossary only renders once the radar has found its own row.
    expect(await screen.findByText(/gets a hand on the ball/)).toBeInTheDocument()
    // Radar and beeswarm read the same pool - one request, not one each.
    const poolCalls = vi.mocked(fetchJson).mock.calls.filter(([path]) => path.startsWith("/players/radar-pool"))
    expect(poolCalls).toHaveLength(1)
  })

  it("explains a missing radar for a player below the volume minimum", async () => {
    renderPlayer("D2", "S")

    expect(await screen.findByText("Not enough season volume yet for a radar profile.")).toBeInTheDocument()
    expect(screen.getByText("Not enough season volume yet for a league comparison.")).toBeInTheDocument()
  })
})
