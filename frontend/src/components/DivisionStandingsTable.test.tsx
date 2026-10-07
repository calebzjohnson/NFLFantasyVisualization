// DivisionStandingsTable.test.tsx
// Tests for one division's standings table: row order, win pct, team page links, and movement arrows.
import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { teamRecord } from "../test/fixtures"
import { renderWithRouter } from "../test/render"
import DivisionStandingsTable from "./DivisionStandingsTable"

const teams = [
  teamRecord("BUF", { wins: 2, win_pct: 1, previous_place: 2 }),
  teamRecord("MIA", { losses: 2, win_pct: 0, previous_place: 1 }),
  teamRecord("NYJ", { previous_place: 3 }),
  teamRecord("NE"),
]

describe("DivisionStandingsTable", () => {
  it("lists teams in the given order with their win pct", () => {
    renderWithRouter(<DivisionStandingsTable division="AFC East" teams={teams} logos={new Map()} />)
    const [, first, second] = screen.getAllByRole("row")

    expect(within(first).getByText("BUF")).toBeInTheDocument()
    expect(within(first).getByText("1.000")).toBeInTheDocument()
    expect(within(second).getByText(".000")).toBeInTheDocument()
  })

  it("links each team to its team page", () => {
    renderWithRouter(<DivisionStandingsTable division="AFC East" teams={teams} logos={new Map()} />)
    expect(screen.getByRole("link", { name: "MIA" })).toHaveAttribute("href", "/teams/MIA")
  })

  it("marks teams that moved since last week, and only those", () => {
    renderWithRouter(<DivisionStandingsTable division="AFC East" teams={teams} logos={new Map()} />)
    const [, buf, mia, nyj, ne] = screen.getAllByRole("row")

    expect(within(buf).getByText("Up 1 spot since last week")).toBeInTheDocument()
    expect(within(mia).getByText("Down 1 spot since last week")).toBeInTheDocument()
    expect(nyj).not.toHaveTextContent("since last week")
    expect(ne).not.toHaveTextContent("since last week") // no previous place yet
  })
})
