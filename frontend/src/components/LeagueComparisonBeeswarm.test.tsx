// LeagueComparisonBeeswarm.test.tsx
// Tests the player beeswarm's tooltip (raw value plus percentile) and that its pool request encodes the position.
import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
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
})
