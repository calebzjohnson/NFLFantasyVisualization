// ComparisonBarChart.test.tsx
// Tests that each stat gets its own labeled set of bars, scaled to its own largest value, with a zero line for negatives and "no stats" for a pick without them.
import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { BarRow } from "../data/chartBuilder"
import type { PlayerMetric } from "../data/playerMetrics"
import { renderWithRouter } from "../test/render"
import ComparisonBarChart from "./ComparisonBarChart"

const YARDS: PlayerMetric = { key: "yards", label: "Yards", value: () => 0 }
const EPA: PlayerMetric = { key: "epa", label: "EPA", value: () => 0 }

function row(id: string, values: BarRow["values"], smallSamples: BarRow["smallSamples"] = {}): BarRow {
  return { id, name: `Player ${id}`, team: "KC", href: `/players/${id}`, color: "#2a78d6", values, smallSamples }
}

function bars(region: HTMLElement) {
  return [...region.querySelectorAll<HTMLElement>("[style*='background-color']")].map((bar) => [
    bar.style.left,
    bar.style.width,
  ])
}

describe("ComparisonBarChart", () => {
  it("scales each stat on its own, linking each name to its page", () => {
    renderWithRouter(
      <ComparisonBarChart
        title="Season Comparison"
        metrics={[YARDS, EPA]}
        rows={[row("a", { yards: 4000, epa: 30 }), row("b", { yards: 2000, epa: -10 })]}
      />,
    )

    const yards = screen.getByRole("region", { name: "Yards" })
    expect(bars(yards)).toEqual([
      ["0%", "100%"],
      ["0%", "50%"],
    ])
    expect(within(yards).getAllByRole("listitem")[0]).toHaveTextContent("Player a4,000")
    expect(within(yards).getAllByRole("link", { name: "Player b" })[0]).toHaveAttribute("href", "/players/b")

    // -10 to 30: zero sits a quarter of the way in, and the negative bar runs left of it.
    const epa = screen.getByRole("region", { name: "EPA" })
    expect(bars(epa)).toEqual([
      ["25%", "75%"],
      ["0%", "25%"],
    ])
    expect(epa.querySelector(".w-px")).toHaveStyle({ left: "25%" })
  })

  it("names picks under a stat's minimum sample beneath its bars", () => {
    const perCarry: PlayerMetric = {
      ...YARDS,
      key: "ypc",
      label: "Yards / Carry",
      minSample: { noun: "carries", min: 10, count: () => 0 },
    }
    renderWithRouter(
      <ComparisonBarChart
        title="Season Comparison"
        metrics={[perCarry]}
        rows={[row("a", { ypc: 9 }, { ypc: 2 }), row("b", { ypc: 4.4 })]}
      />,
    )

    expect(screen.getByRole("region", { name: "Yards / Carry" })).toHaveTextContent(
      "Small sample: Player a (2 carries). Under 10 carries, this swings a lot on a handful of plays.",
    )
  })

  it("marks a pick without stats instead of drawing a bar", () => {
    renderWithRouter(<ComparisonBarChart title="Season Comparison" metrics={[YARDS]} rows={[row("a", { yards: null })]} />)

    const yards = screen.getByRole("region", { name: "Yards" })
    expect(bars(yards)).toEqual([])
    expect(within(yards).getByRole("listitem")).toHaveTextContent("no stats")
  })
})
