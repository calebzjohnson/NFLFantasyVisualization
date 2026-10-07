// PlayerPage.test.tsx
// Tests that the player page only shows radar/usage/league panels for positions that have them.
import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { fetchJson } from "../lib/api"
import { playerBio, teamInfo } from "../test/fixtures"
import { mockApi, renderWithRouter } from "../test/render"
import PlayerPage from "./PlayerPage"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

const dbPool = {
  position: "CB",
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

// The group comes from the bio rather than being derived from `position` -
// a defensive end's bucket depends on his team's scheme, so only the server
// can say whether he's an EDGE or an interior lineman.
function renderPlayer(playerId: string, position: string, positionGroup: string) {
  mockApi({
    "/teams": [teamInfo("KC")],
    "/players/radar-pool?position=CB": dbPool,
    [`/players/${playerId}/bio`]: playerBio({
      player_id: playerId,
      display_name: `${position} Player`,
      position,
      position_group: positionGroup,
    }),
    [`/players/${playerId}/games`]: [],
  })
  renderWithRouter(<PlayerPage />, { route: `/players/${playerId}`, path: "/players/:playerId" })
}

describe("PlayerPage", () => {
  it.each([
    ["O1", "OT", "OL"],
    ["K1", "K", "K"],
    ["P1", "P", "P"],
  ])("shows only the game log for a %s (%s)", async (playerId, position, group) => {
    renderPlayer(playerId, position, group)

    expect(await screen.findByText("Game Log")).toBeInTheDocument()
    expect(screen.queryByText("Player Breakdown")).not.toBeInTheDocument()
    expect(screen.queryByText("League Comparison")).not.toBeInTheDocument()
  })

  it("shows the radar and league comparison for a defender", async () => {
    renderPlayer("D1", "CB", "CB")

    expect(await screen.findByText("Player Breakdown")).toBeInTheDocument()
    expect(screen.getByText("League Comparison")).toBeInTheDocument()
    // The glossary only renders once the radar has found its own row.
    expect(await screen.findByText(/gets a hand on the ball/)).toBeInTheDocument()
    // Radar and beeswarm read the same pool - one request, not one each.
    const poolCalls = vi.mocked(fetchJson).mock.calls.filter(([path]) => path.startsWith("/players/radar-pool"))
    expect(poolCalls).toHaveLength(1)
  })

  it("names its charts, offers their data as tables, and titles the tab with the player", async () => {
    renderPlayer("D1", "CB", "CB")
    await screen.findByText(/gets a hand on the ball/)

    expect(
      screen.getByRole("figure", {
        name: "CB Player compared with every other qualifying CB this season on 1 stats, as percentile ranks where 50 is league average. Strongest: Ball Prod. (90th). Weakest: Ball Prod. (90th).",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("figure", { name: /^Every qualifying CB this season \(1\), .* with CB Player highlighted\.$/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole("table", { name: "CB Player's percentile ranks among CBs" })).toHaveTextContent(
      "Ball Prod.12.590th",
    )
    expect(screen.getByRole("table", { name: /Every qualifying CB's stats/ })).toHaveTextContent("12.5 (90th)")
    expect(document.title).toBe("CB Player · Plot the Pigskin")
  })

  it("encodes a player id with reserved characters in every API path", async () => {
    const playerId = "a/b?c#d"
    const encoded = "a%2Fb%3Fc%23d"
    mockApi({
      "/teams": [teamInfo("KC")],
      "/players/radar-pool?position=CB": dbPool,
      [`/players/${encoded}/bio`]: playerBio({ player_id: playerId, position: "CB", position_group: "CB" }),
      [`/players/${encoded}/games`]: [],
    })
    renderWithRouter(<PlayerPage />, { route: `/players/${encoded}`, path: "/players/:playerId" })

    expect(await screen.findByText("Game Log")).toBeInTheDocument()
    await waitFor(() => {
      const paths = vi.mocked(fetchJson).mock.calls.map(([path]) => path)
      for (const endpoint of ["bio", "games", "usage"]) {
        expect(paths).toContain(`/players/${encoded}/${endpoint}`)
      }
    })
  })

  it("explains a missing radar for a player below the volume minimum", async () => {
    renderPlayer("D2", "S", "CB")

    expect(await screen.findByText("Not enough season volume yet for a radar profile.")).toBeInTheDocument()
    expect(screen.getByText("Not enough season volume yet for a league comparison.")).toBeInTheDocument()
  })
})
