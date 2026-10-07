// TeamEfficiencyScatter.test.tsx
// Tests that the efficiency panel can be expanded into a dialog, and that the
// control is absent when there is nothing to chart.
import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { TeamEfficiency } from "../data/efficiency"
import { useFetch } from "../lib/useFetch"
import { teamInfo } from "../test/fixtures"
import { renderWithRouter } from "../test/render"
import TeamEfficiencyScatter from "./TeamEfficiencyScatter"

// Mocked directly (not via mockApi): useFetch caches per path for the whole
// file, and the empty-data test needs a different answer for /teams/efficiency.
vi.mock("../lib/useFetch", () => ({ useFetch: vi.fn() }))

const efficiency: TeamEfficiency[] = [
  { team: "KC", offensive_epa_per_play: 0.2, offensive_plays: 200, defensive_epa_per_play: -0.1, defensive_plays: 190 },
  { team: "BUF", offensive_epa_per_play: 0.1, offensive_plays: 210, defensive_epa_per_play: 0.05, defensive_plays: 180 },
]

function mockFetch(efficiencyRows: TeamEfficiency[]) {
  vi.mocked(useFetch).mockImplementation((path: string | null) => ({
    data: (path === "/teams/efficiency" ? efficiencyRows : [teamInfo("KC"), teamInfo("BUF")]) as never,
    loading: false,
    error: null,
  }))
}

describe("TeamEfficiencyScatter", () => {
  it("opens a larger chart in a dialog", () => {
    mockFetch(efficiency)
    renderWithRouter(<TeamEfficiencyScatter />)

    fireEvent.click(screen.getByRole("button", { name: /larger chart/i }))

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Team Efficiency")
  })

  it("offers no expand control when there are no plays to chart", () => {
    mockFetch([])
    renderWithRouter(<TeamEfficiencyScatter />)

    expect(screen.getByText("No plays to chart yet.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /larger chart/i })).not.toBeInTheDocument()
  })
})
