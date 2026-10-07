// TrendChart.test.tsx
// Tests that the trend chart names itself in plain language and offers its weekly numbers as a table.
import { screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TEAM_METRICS } from "../data/teamMetrics"
import { teamInfo } from "../test/fixtures"
import { mockApi, renderWithRouter } from "../test/render"
import TrendChart from "./TrendChart"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

const up = { id: "BUF", name: "Buffalo Bills", team: "BUF", headshot: null, slope: 3, games: [{ week: 1, value: 20 }, { week: 2, value: 26 }] }
const down = { id: "MIA", name: "Miami Dolphins", team: "MIA", headshot: null, slope: -4, games: [{ week: 2, value: 17 }] }

describe("TrendChart", () => {
  it("names the chart and lists each line's weekly values with its direction", async () => {
    mockApi({ "/teams": [teamInfo("BUF"), teamInfo("MIA")] })
    renderWithRouter(
      <TrendChart
        title="Trending Teams"
        metrics={TEAM_METRICS}
        plural="teams"
        singular="team"
        loading={false}
        error={null}
        trends={() => ({ up: [up], down: [down] })}
      />,
    )

    expect(
      screen.getByRole("figure", {
        name: "Trending Teams: the 2 teams trending up or down the most in points / game, week 1 to week 2.",
      }),
    ).toBeInTheDocument()
    const table = screen.getByRole("table")
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Team", "Trend", "Wk 1", "Wk 2"])
    const [, bills, dolphins] = within(table).getAllByRole("row")
    expect(bills).toHaveTextContent(/Buffalo BillsUp20(\.0)?26(\.0)?/)
    expect(dolphins).toHaveTextContent(/Miami DolphinsDown—17/)
  })
})
