// TeamLeadersPanel.test.tsx
// Tests for Team Leaders: top-5 cutoff, default sort, Offense/Defense toggle, and re-sorting.
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { TeamSeasonRow } from "../data/teamMetrics"
import TeamLeadersPanel from "./TeamLeadersPanel"

// Six teams: points scored 10..60, points allowed 60..10 (one game each).
const rows: TeamSeasonRow[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  team: `T${n}`,
  name: `Team ${n}`,
  logo: "",
  games: 1,
  points_for: n * 10,
  points_against: 70 - n * 10,
}))

function teamNamesInOrder(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getByText(/^Team \d$/).textContent ?? "")
}

describe("TeamLeadersPanel", () => {
  it("shows the top 5 offenses by points per game", () => {
    render(<TeamLeadersPanel rows={rows} loading={false} error={null} />)
    expect(teamNamesInOrder()).toEqual(["Team 6", "Team 5", "Team 4", "Team 3", "Team 2"])
  })

  it("switches to defense, sorted fewest points allowed first", () => {
    render(<TeamLeadersPanel rows={rows} loading={false} error={null} />)
    fireEvent.click(screen.getByRole("button", { name: "Defense" }))

    expect(screen.getByRole("button", { name: "Defense" })).toHaveAttribute("aria-pressed", "true")
    expect(teamNamesInOrder()).toEqual(["Team 6", "Team 5", "Team 4", "Team 3", "Team 2"])
  })

  it("flips the order when the active column is clicked again", () => {
    render(<TeamLeadersPanel rows={rows} loading={false} error={null} />)
    fireEvent.click(screen.getByRole("button", { name: /^PTS/ }))
    expect(teamNamesInOrder()).toEqual(["Team 1", "Team 2", "Team 3", "Team 4", "Team 5"])
  })

  it("shows loading and error states", () => {
    const { rerender } = render(<TeamLeadersPanel rows={null} loading error={null} />)
    expect(screen.getByText("Loading…")).toBeInTheDocument()

    rerender(<TeamLeadersPanel rows={null} loading={false} error="boom" />)
    expect(screen.getByText("Couldn't load team leaders: boom")).toBeInTheDocument()
  })
})
