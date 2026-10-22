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

  it("orders each stat's bars greatest to least on its own, picks without stats last", () => {
    renderWithRouter(
      <ComparisonBarChart
        title="Season Comparison"
        metrics={[YARDS, EPA]}
        rows={[row("a", { yards: 900, epa: 0.4 }), row("b", { yards: null, epa: null }), row("c", { yards: 1200, epa: -0.1 })]}
      />,
    )

    const names = (stat: string) =>
      within(screen.getByRole("region", { name: stat }))
        .getAllByRole("link")
        .map((link) => link.textContent)
    expect(names("Yards")).toEqual(["Player c", "Player a", "Player b"])
    expect(names("EPA")).toEqual(["Player a", "Player c", "Player b"])
  })

  it("puts the best first for a lower-is-better stat: least first", () => {
    const picks: PlayerMetric = { ...YARDS, key: "int", label: "Interceptions", lowerIsBetter: true }
    renderWithRouter(
      <ComparisonBarChart title="Season Comparison" metrics={[picks]} rows={[row("a", { int: 9 }), row("b", { int: 2 })]} />,
    )
    const names = within(screen.getByRole("region", { name: "Interceptions" }))
      .getAllByRole("link")
      .map((link) => link.textContent)
    expect(names).toEqual(["Player b", "Player a"])
  })

  it("marks a pick without stats instead of drawing a bar", () => {
    renderWithRouter(<ComparisonBarChart title="Season Comparison" metrics={[YARDS]} rows={[row("a", { yards: null })]} />)

    const yards = screen.getByRole("region", { name: "Yards" })
    expect(bars(yards)).toEqual([])
    expect(within(yards).getByRole("listitem")).toHaveTextContent("no stats")
  })
})
