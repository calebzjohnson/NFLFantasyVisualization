// MetricScatter.test.tsx
// Tests for the shared scatter's axis pickers and its loading/empty/error states.
// The chart itself isn't rendered here - recharts needs real layout, which jsdom lacks.
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TEAM_METRICS } from "../data/teamMetrics"
import MetricScatter from "./MetricScatter"

function scatter(props: Partial<Parameters<typeof MetricScatter>[0]> = {}) {
  return (
    <MetricScatter
      title="Compare Things"
      metrics={TEAM_METRICS}
      rows={null}
      loading={false}
      error={null}
      noun="things"
      emptyText="Nothing yet."
      caption="caption"
      Dot={() => null}
      renderTooltipHeader={() => null}
      {...props}
    />
  )
}

describe("MetricScatter", () => {
  it("defaults the axes to the first two metrics", () => {
    render(scatter())
    expect(screen.getByLabelText("X axis")).toHaveValue(TEAM_METRICS[0].label)
    expect(screen.getByLabelText("Y axis")).toHaveValue(TEAM_METRICS[1].label)
  })

  it("starts on the requested axes", () => {
    render(scatter({ initialX: "points", initialY: "points_allowed" }))
    expect(screen.getByLabelText("Y axis")).toHaveValue("Points Allowed / Game")
  })

  it("shows loading, error, and empty states", () => {
    const { rerender } = render(scatter({ loading: true }))
    expect(screen.getByText("Loading…")).toBeInTheDocument()

    rerender(scatter({ error: "boom" }))
    expect(screen.getByText("Couldn't load things: boom")).toBeInTheDocument()

    rerender(scatter({ rows: [] }))
    expect(screen.getByText("Nothing yet.")).toBeInTheDocument()
  })
})
