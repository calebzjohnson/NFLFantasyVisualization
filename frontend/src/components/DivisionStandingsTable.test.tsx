// DivisionStandingsTable.test.tsx
// Tests for one division's standings table: row order, win pct, and team page links.
import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { teamRecord } from "../test/fixtures"
import { renderWithRouter } from "../test/render"
import DivisionStandingsTable from "./DivisionStandingsTable"

const teams = [
  teamRecord("BUF", { wins: 2, win_pct: 1 }),
  teamRecord("MIA", { losses: 2, win_pct: 0 }),
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
})
