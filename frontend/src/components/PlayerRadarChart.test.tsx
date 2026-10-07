// PlayerRadarChart.test.tsx
// Tests that the player radar's pool request encodes the position.
import { waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { PositionGroup } from "../data/leaderCategories"
import { fetchJson } from "../lib/api"
import { mockApi, renderWithRouter } from "../test/render"
import PlayerRadarChart from "./PlayerRadarChart"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

describe("PlayerRadarChart", () => {
  it("encodes the position in the pool request", async () => {
    mockApi({})
    const position = "W/R?x=1#y" as PositionGroup
    renderWithRouter(<PlayerRadarChart playerId="p1" position={position} teamColor="#000" />)

    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith("/players/radar-pool?position=W%2FR%3Fx%3D1%23y"),
    )
  })
})
