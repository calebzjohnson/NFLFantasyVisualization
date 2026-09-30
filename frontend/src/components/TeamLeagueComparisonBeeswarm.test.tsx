// TeamLeagueComparisonBeeswarm.test.tsx
// Tests that the team beeswarm's hover tooltip shows the raw stat value alongside the percentile.
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SwarmTooltip } from "./TeamLeagueComparisonBeeswarm"

describe("SwarmTooltip", () => {
  it("shows the team name, stat value, and percentile", () => {
    const point = { team: { team: "KC", axes: [] }, axisIndex: 0, axisLabel: "Pass Offense", value: 0.123, x: 0, y: 3 }
    render(
      <SwarmTooltip active payload={[{ payload: point }]} nameByTeam={new Map([["KC", "Kansas City Chiefs"]])} />,
    )
    expect(screen.getByText("Kansas City Chiefs")).toBeInTheDocument()
    expect(screen.getByText("Pass Offense")).toBeInTheDocument()
    expect(screen.getByText("0.123")).toBeInTheDocument()
    expect(screen.getByText("3rd")).toBeInTheDocument()
  })
})
