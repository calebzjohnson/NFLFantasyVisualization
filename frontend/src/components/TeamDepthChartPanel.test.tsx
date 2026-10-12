// TeamDepthChartPanel.test.tsx
// Tests the depth chart tab: a table per unit, status badges, and the report.
import { screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { depthChart } from "../test/fixtures"
import { mockApi, renderWithRouter } from "../test/render"
import TeamDepthChartPanel from "./TeamDepthChartPanel"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

describe("TeamDepthChartPanel", () => {
  beforeEach(() => {
    mockApi({ "/teams/BUF/depth-chart": depthChart() })
  })

  it("heads each unit with its nflverse group name", async () => {
    renderWithRouter(<TeamDepthChartPanel teamAbbr="BUF" />)

    expect(await screen.findByRole("heading", { name: "3WR 1TE" })).toBeInTheDocument()
  })

  it("lays out a row per position with players across in depth order", async () => {
    renderWithRouter(<TeamDepthChartPanel teamAbbr="BUF" />)

    const table = await screen.findByRole("table", { name: "3WR 1TE depth chart" })
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Pos",
      "1st",
      "2nd",
    ])
    const quarterbacks = within(table).getByRole("row", { name: /^QB/ })
    expect(within(quarterbacks).getByRole("link", { name: "Q One" })).toHaveAttribute(
      "href",
      "/players/Q1",
    )
    expect(within(quarterbacks).getByRole("link", { name: "Q Two" })).toBeInTheDocument()
  })

  it("fills a slot's unused depth with a dash", async () => {
    renderWithRouter(<TeamDepthChartPanel teamAbbr="BUF" />)

    const table = await screen.findByRole("table", { name: "3WR 1TE depth chart" })
    const receivers = within(table).getByRole("row", { name: /^WR/ })
    expect(within(receivers).getByText("—")).toBeInTheDocument()
  })

  it("flags an unavailable player in the grid, naming the status in full", async () => {
    renderWithRouter(<TeamDepthChartPanel teamAbbr="BUF" />)

    const table = await screen.findByRole("table", { name: "3WR 1TE depth chart" })
    const receivers = within(table).getByRole("row", { name: /^WR/ })
    expect(within(receivers).getByText("Questionable - Knee")).toBeInTheDocument()
    expect(within(receivers).getByTitle("Questionable - Knee")).toHaveTextContent("Q")
  })

  it("tabulates every flagged player's cause and practice participation", async () => {
    renderWithRouter(<TeamDepthChartPanel teamAbbr="BUF" />)

    const heading = await screen.findByRole("heading", { name: "Injury Report" })
    const table = within(heading.closest("section")!).getByRole("table")
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Pos",
      "Player",
      "Status",
      "Injury",
      "Practice",
    ])

    const [, reserve, questionable] = within(table).getAllByRole("row")
    // Reserve carries no cause - the weekly report barely covers those players.
    expect(reserve).toHaveTextContent("QBQ TwoInjury Reserve——")
    expect(questionable).toHaveTextContent("WRW OneQuestionableKneeLimited Participation")
  })

  // A different team: useFetch caches per path for the whole test file, so
  // /teams/BUF/depth-chart can't answer differently here.
  it("says so when nobody carries a status", async () => {
    mockApi({ "/teams/MIA/depth-chart": depthChart({ report: [] }) })
    renderWithRouter(<TeamDepthChartPanel teamAbbr="MIA" />)

    expect(await screen.findByText("No players carry a status.")).toBeInTheDocument()
  })

  it("reports a failed load", async () => {
    renderWithRouter(<TeamDepthChartPanel teamAbbr="NYJ" />)

    expect(await screen.findByText(/Couldn't load depth chart/)).toBeInTheDocument()
  })
})
