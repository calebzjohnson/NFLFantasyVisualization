// TeamTendenciesPanel.test.tsx
// Tests the Overview play-calling panel: each split as a bar, the league's
// split beside it, and the rank.
import { fireEvent, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mockApi, renderWithRouter } from "../test/render"
import TeamTendenciesPanel from "./TeamTendenciesPanel"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

function rate(key: string, label: string, group: string, value: number, league: number) {
  return { key, label, group, value, rank: 3, teams: 32, league_average: league }
}

const tendencies = {
  team: "BUF",
  tendencies: [
    rate("dropback_rate", "Dropback Rate", "Balance", 64.2, 60.9),
    rate("run_rate", "Run Rate", "Balance", 35.8, 39.1),
    rate("third_down_conversion", "Third Down Conversion", "Third Down", 51.9, 39.5),
  ],
}

describe("TeamTendenciesPanel", () => {
  beforeEach(() => {
    mockApi({ "/teams/BUF/tendencies": tendencies })
    renderWithRouter(<TeamTendenciesPanel teamAbbr="BUF" />)
  })

  it("draws a split as one bar, with the league's split beneath it", async () => {
    const figure = await screen.findByRole("figure", { name: /^Dropback \/ Run\./ })

    expect(within(figure).getByText("Team")).toBeInTheDocument()
    expect(within(figure).getByText("League")).toBeInTheDocument()
    expect(within(figure).getByText("60.9 / 39.1")).toBeInTheDocument()
  })

  it("names both sides so the colours aren't carrying it alone", async () => {
    const figure = await screen.findByRole("figure", { name: /^Dropback \/ Run\./ })

    expect(within(figure).getByText("Dropback")).toBeInTheDocument()
    expect(within(figure).getByText("Run")).toBeInTheDocument()
  })

  it("gives each side its own value and rank", async () => {
    const figure = await screen.findByRole("figure", { name: /^Dropback \/ Run\./ })

    expect(within(figure).getByText("64.2")).toBeInTheDocument()
    expect(within(figure).getByText("35.8")).toBeInTheDocument()
    expect(within(figure).getAllByText("3rd")).toHaveLength(2)
  })

  it("names the down in the group heading, since the segments don't", async () => {
    expect(await screen.findByRole("heading", { name: "Third Down" })).toBeInTheDocument()
  })

  it("fills a conversion's bar with the share that failed", async () => {
    const figure = await screen.findByRole("figure", { name: /^Third Down\./ })

    expect(within(figure).getByText("Converted")).toBeInTheDocument()
    expect(within(figure).getByText("Failed")).toBeInTheDocument()
    expect(within(figure).getByText("51.9")).toBeInTheDocument()
    expect(within(figure).getByText("48.1")).toBeInTheDocument()
  })

  it("bolds the team's numbers when the team bar is pointed at", async () => {
    const figure = await screen.findByRole("figure", { name: /^Dropback \/ Run\./ })

    expect(within(figure).getByText("64.2")).not.toHaveClass("font-bold")
    fireEvent.mouseEnter(within(figure).getByRole("button", { name: /team$/ }))
    expect(within(figure).getByText("64.2")).toHaveClass("font-bold")
    expect(within(figure).getByText("35.8")).toHaveClass("font-bold")
    expect(within(figure).getByText("60.9 / 39.1")).not.toHaveClass("font-bold")
  })

  it("bolds the league average instead when its own bar is pointed at", async () => {
    const figure = await screen.findByRole("figure", { name: /^Dropback \/ Run\./ })

    fireEvent.mouseEnter(within(figure).getByRole("button", { name: /league average$/ }))
    expect(within(figure).getByText("60.9 / 39.1")).toHaveClass("font-bold")
    expect(within(figure).getByText("64.2")).not.toHaveClass("font-bold")
  })

  it("describes each bar for anyone not seeing it", async () => {
    expect(
      await screen.findByRole("figure", {
        name:
          "Dropback / Run. Dropback 64.2%, 3rd of 32. Run 35.8%, 3rd. League 60.9% and 39.1%.",
      }),
    ).toBeInTheDocument()
  })

  it("groups the bars", async () => {
    expect(await screen.findByRole("heading", { name: "Balance" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Third Down" })).toBeInTheDocument()
  })

  it("reports a failed load", async () => {
    renderWithRouter(<TeamTendenciesPanel teamAbbr="NYJ" />)

    expect(await screen.findByText(/Couldn't load play calling/)).toBeInTheDocument()
  })
})
