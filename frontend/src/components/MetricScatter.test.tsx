// MetricScatter.test.tsx
// Tests for the shared scatter's axis pickers, highlight search, loading/empty/error states, and touchscreen details box.
// The chart itself isn't rendered here - recharts needs real layout, which jsdom lacks.
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TEAM_METRICS } from "../data/teamMetrics"
import MetricScatter, { groupCoincidentPoints, withHighlightedOnTop } from "./MetricScatter"

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
      rowName={() => "Row"}
      rowId={() => "row"}
      tapPrompt="Tap a thing."
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

  it("names the chart after its axes and lists each row in a data table", () => {
    const rows = [
      { name: "Alpha", games: 2, points_for: 40, points_against: 20 },
      { name: "Beta", games: 2, points_for: 30, points_against: 50 },
    ]
    render(scatter({ rows, initialX: "points", initialY: "points_allowed", rowName: (row) => String(row.name) }))

    expect(
      screen.getByRole("figure", { name: /^Compare Things: 2 things plotted by Points \/ Game \(across\) and Points Allowed \/ Game \(up\)/ }),
    ).toBeInTheDocument()
    const table = screen.getByRole("table")
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Name",
      "Points / Game",
      "Points Allowed / Game",
    ])
    expect(table).toHaveTextContent("Alpha")
    expect(table).toHaveTextContent("Beta")
  })

  it("highlights rows picked in the search, naming them in the chart's label", () => {
    const rows = [
      { name: "Alpha", games: 2, points_for: 40, points_against: 20 },
      { name: "Beta", games: 2, points_for: 30, points_against: 50 },
    ]
    const name = (row: { name?: unknown }) => String(row.name)
    render(scatter({ rows, rowName: name, rowId: name }))

    fireEvent.change(screen.getByLabelText("Highlight"), { target: { value: "Beta" } })
    expect(screen.getByRole("figure", { name: /Highlighted: Beta\.$/ })).toBeInTheDocument()

    // The chip clears it, and the search box comes back for another pick.
    fireEvent.click(screen.getByRole("button", { name: "Stop highlighting Beta" }))
    expect(screen.getByRole("figure", { name: /median in each stat\.$/ })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Highlight"), { target: { value: "Alpha" } })
    expect(screen.getByRole("figure", { name: /Highlighted: Alpha\.$/ })).toBeInTheDocument()

  })

  it("leaves out rows under a per-play stat's minimum, and says so", () => {
    const sample = { noun: "carries", min: 10, count: (row: Record<string, unknown>) => Number(row.carries) }
    const metrics = [
      { key: "carries", label: "Carries", value: (row: Record<string, unknown>) => Number(row.carries) },
      { key: "ypc", label: "Yards / Carry", minSample: sample, value: (row: Record<string, unknown>) => Number(row.ypc) },
    ]
    const rows = [
      { name: "Starter", carries: 120, ypc: 4.5 },
      { name: "Backup", carries: 3, ypc: 11 },
    ]
    const { rerender } = render(scatter({ metrics, rows, rowName: (row) => String(row.name), rowId: (row) => String(row.name) }))

    const table = screen.getByRole("table")
    expect(table).toHaveTextContent("Starter")
    expect(table).not.toHaveTextContent("Backup")
    expect(
      screen.getByText("Things with fewer than 10 carries aren't shown, since Yards / Carry swings a lot on a handful of plays."),
    ).toBeInTheDocument()

    // With nobody over the minimum, the note explains the empty chart.
    rerender(scatter({ metrics, rows: [rows[1]], rowName: (row) => String(row.name), rowId: (row) => String(row.name) }))
    expect(screen.queryByText("Nothing yet.")).not.toBeInTheDocument()
    expect(screen.getByText(/^Things with fewer than 10 carries aren't shown/)).toBeInTheDocument()
  })

  it("with pinned picks, swaps the pickers and search for a color key, keeps picks under a minimum, and flags them", () => {
    const sample = { noun: "carries", min: 10, count: (row: Record<string, unknown>) => Number(row.carries) }
    const metrics = [
      { key: "carries", label: "Carries", value: (row: Record<string, unknown>) => Number(row.carries) },
      { key: "ypc", label: "Yards / Carry", minSample: sample, value: (row: Record<string, unknown>) => Number(row.ypc) },
    ]
    const rows = [
      { name: "Starter", carries: 120, ypc: 4.5 },
      { name: "Backup", carries: 3, ypc: 11 },
      { name: "Pick", carries: 6, ypc: 2 },
    ]
    const name = (row: { name?: unknown }) => String(row.name)
    render(scatter({ metrics, rows, rowName: name, rowId: name, pinned: [{ id: "Pick", name: "Pick", color: "#2a78d6" }] }))

    expect(screen.queryByLabelText("X axis")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Highlight")).not.toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Picks" })).toHaveTextContent("Pick")
    expect(screen.getByRole("figure", { name: /Picked: Pick\.$/ })).toBeInTheDocument()
    const table = screen.getByRole("table")
    expect(table).toHaveTextContent("Pick")
    expect(table).not.toHaveTextContent("Backup")
    expect(screen.getByText("Small sample for Yards / Carry: Pick (6 carries).")).toBeInTheDocument()
  })

  it("hides the highlight search until there are rows", () => {
    render(scatter({ loading: true }))
    expect(screen.queryByLabelText("Highlight")).not.toBeInTheDocument()
  })

  it("shows a tap prompt below the chart only on a touchscreen", () => {
    const rows = [{ name: "Alpha", games: 2, points_for: 40, points_against: 20 }]
    const { unmount } = render(scatter({ rows }))
    expect(screen.queryByText("Tap a thing.")).not.toBeInTheDocument()
    unmount()

    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    render(scatter({ rows }))
    expect(screen.getByText("Tap a thing.")).toBeInTheDocument()
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
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

describe("withHighlightedOnTop", () => {
  const id = (row: { id: string }) => row.id

  it("matches plain grouping when nothing is highlighted", () => {
    const rows = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 0 },
    ]
    expect(withHighlightedOnTop(rows, null, id)).toEqual(groupCoincidentPoints(rows))
  })

  it("pulls a highlighted row out of its tie cluster and draws it last", () => {
    const rows = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 0 },
      { id: "c", x: 0, y: 0 },
      { id: "d", x: 5, y: 1 },
    ]
    const points = withHighlightedOnTop(rows, "b", id)

    expect(points.at(-1)).toEqual({ kind: "solo", x: 0, y: 0, row: rows[1] })
    expect(points.find((p) => p.kind === "cluster")).toMatchObject({ members: [rows[0], rows[2]] })
  })

  it("draws pinned rows on top, out of any tie, with the highlighted row last of all", () => {
    const rows = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 0 },
      { id: "c", x: 0, y: 0 },
      { id: "d", x: 1, y: 1 },
    ]
    const points = withHighlightedOnTop(rows, "d", id, new Set(["b"]))
    expect(points.map((p) => (p.kind === "solo" ? p.row.id : `cluster:${p.members.map((m) => m.id).join("")}`))).toEqual([
      "cluster:ac",
      "b",
      "d",
    ])
  })
})
