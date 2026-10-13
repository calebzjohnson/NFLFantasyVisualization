// LeagueComparisonBeeswarm.test.tsx
// Tests the player beeswarm's tooltip (raw value plus percentile), that its pool request encodes the position, and its phone/touchscreen prompts.
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PositionGroup } from "../data/leaderCategories"
import { fetchJson } from "../lib/api"
import { mockApi, renderWithRouter } from "../test/render"
import LeagueComparisonBeeswarm, { SwarmTooltip } from "./LeagueComparisonBeeswarm"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

const player = { player_id: "p1", name: "Jane Doe", team: "KC", axes: [] }

function renderTooltip(value: number | null) {
  const point = { player, axisIndex: 0, axisLabel: "EPA/Dropback", value, x: 0, y: 82.4 }
  render(<SwarmTooltip active payload={[{ payload: point }]} />)
}

describe("SwarmTooltip", () => {
  it("shows the player, stat value, and percentile", () => {
    renderTooltip(0.21)
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    expect(screen.getByText("EPA/Dropback")).toBeInTheDocument()
    expect(screen.getByText("0.21")).toBeInTheDocument()
    expect(screen.getByText("82nd")).toBeInTheDocument()
  })

  it("shows a dash when the value is missing", () => {
    renderTooltip(null)
    expect(screen.getByText("—")).toBeInTheDocument()
  })
})

describe("LeagueComparisonBeeswarm", () => {
  it("encodes the position in the pool request", async () => {
    mockApi({})
    const position = "W/R?x=1#y" as PositionGroup
    renderWithRouter(<LeagueComparisonBeeswarm playerId="p1" position={position} teamColor="#000" />)

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith("/players/radar-pool?position=W%2FR%3Fx%3D1%23y"),
    )
  })

  // Separate positions: useFetch caches each path for the whole file.
  function pool(position: string) {
    return {
      [`/players/radar-pool?position=${position}`]: {
        position,
        axes: [{ key: "epa", label: "EPA / Dropback" }],
        players: [{ ...player, axes: [{ key: "epa", value: 0.2, percentile: 80 }] }],
      },
    }
  }

  it("on a touchscreen phone, prompts a tap and says to swipe for every stat", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    mockApi(pool("QB"))
    renderWithRouter(<LeagueComparisonBeeswarm playerId="p1" position={"QB" as PositionGroup} teamColor="#000" />)
    expect(await screen.findByText("Tap a dot to see that player's numbers.")).toBeInTheDocument()
    expect(screen.getByText(/Swipe the chart sideways to see all 1 stats\./)).toBeInTheDocument()
  })

  it("with a mouse on a wide screen, says to click instead", async () => {
    mockApi(pool("RB"))
    renderWithRouter(<LeagueComparisonBeeswarm playerId="p1" position={"RB" as PositionGroup} teamColor="#000" />)
    expect(await screen.findByText(/click a dot to view that player/)).toBeInTheDocument()
    expect(screen.queryByText(/^Tap a dot/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Swipe/)).not.toBeInTheDocument()
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})
