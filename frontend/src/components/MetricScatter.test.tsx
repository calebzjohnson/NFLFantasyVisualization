// MetricScatter.test.tsx
// Tests for the shared scatter's axis pickers and its loading/empty/error states.
// The chart itself isn't rendered here - recharts needs real layout, which jsdom lacks.
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TEAM_METRICS } from "../data/teamMetrics"
import MetricScatter, { groupCoincidentPoints } from "./MetricScatter"

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

describe("groupCoincidentPoints", () => {
  it("keeps a unique point as its own solo entry", () => {
    const points = groupCoincidentPoints([{ id: "a", x: 1, y: 2 }])
    expect(points).toEqual([{ kind: "solo", x: 1, y: 2, row: { id: "a", x: 1, y: 2 } }])
  })

  it("groups rows sharing the exact same coordinate into one cluster", () => {
    const rows = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 0 },
      { id: "c", x: 5, y: 1 },
    ]
    const points = groupCoincidentPoints(rows)

    expect(points).toHaveLength(2)
    const cluster = points.find((p) => p.kind === "cluster")
    expect(cluster).toMatchObject({ x: 0, y: 0, members: [rows[0], rows[1]] })
    const solo = points.find((p) => p.kind === "solo")
    expect(solo).toEqual({ kind: "solo", x: 5, y: 1, row: rows[2] })
  })

  it("does not group rows that merely round to the same tick", () => {
    const rows = [
      { id: "a", x: 1.4, y: 0 },
      { id: "b", x: 1.6, y: 0 },
    ]
    const points = groupCoincidentPoints(rows)
    expect(points.every((p) => p.kind === "solo")).toBe(true)
  })
})
