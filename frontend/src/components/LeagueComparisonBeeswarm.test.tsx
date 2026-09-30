// LeagueComparisonBeeswarm.test.tsx
// Tests that the player beeswarm's hover tooltip shows the raw stat value alongside the percentile.
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SwarmTooltip } from "./LeagueComparisonBeeswarm"

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
