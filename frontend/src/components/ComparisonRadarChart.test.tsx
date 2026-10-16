// ComparisonRadarChart.test.tsx
// Tests that the radar names its picks and pool in plain language, keys each pick's color, lists every pick's numbers per stat as a table, and prompts taps on touchscreens.
// The chart itself isn't drawn here - recharts needs real layout, which jsdom lacks.
import { render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import ComparisonRadarChart from "./ComparisonRadarChart"

const AXES = [
  { key: "targets", label: "Targets" },
  { key: "ypr", label: "Yards / Reception" },
  { key: "wopr", label: "WOPR" },
]
const OUTLINES = [
  {
    id: "a",
    name: "Jane Doe",
    color: "#2a78d6",
    spokes: [
      { value: "60", percentile: 98 },
      { value: "12.5", percentile: 70 },
      { value: "0.61", percentile: 90 },
    ],
  },
  {
    id: "b",
    name: "Sam Roe",
    color: "#eb6834",
    spokes: [
      { value: "20", percentile: 30 },
      { value: null, percentile: null },
      { value: "0.2", percentile: 25 },
    ],
  },
]

function renderRadar() {
  render(
    <ComparisonRadarChart axes={AXES} outlines={OUTLINES} poolText="qualifying WRs" notes={["WRs need 12 targets."]} />,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ComparisonRadarChart", () => {
  it("names the picks and the pool, keys their colors, and tables every pick's numbers per stat", () => {
    renderRadar()
    expect(
      screen.getByRole("figure", {
        name: "Radar of Jane Doe, Sam Roe on 3 stats, as percentile ranks among qualifying WRs this season; further out is better, and the dashed ring is the 50th percentile.",
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Picks" })).toHaveTextContent("Jane DoeSam Roe")
    expect(screen.getByText(/WRs need 12 targets\.$/)).toBeInTheDocument()

    const table = screen.getByRole("table")
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Stat", "Jane Doe", "Sam Roe"])
    const [, ...rows] = within(table).getAllByRole("row")
    expect(rows.map((row) => row.textContent)).toEqual([
      "Targets60 (98th)20 (30th)",
      "Yards / Reception12.5 (70th)—",
      "WOPR0.61 (90th)0.2 (25th)",
    ])
  })

  it("says to point at a stat with a mouse, and to tap one on a touchscreen", () => {
    renderRadar()
    expect(screen.getByText(/Point at a stat to see every pick's numbers on it\./)).toBeInTheDocument()

    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    renderRadar()
    expect(screen.getByText("Tap a stat to see every pick's numbers on it.")).toBeInTheDocument()
  })
})
