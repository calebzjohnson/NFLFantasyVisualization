// TeamTendenciesPanel.test.tsx
// Tests the Overview play-calling panel: each rate with its league rank.
import { screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mockApi, renderWithRouter } from "../test/render"
import TeamTendenciesPanel from "./TeamTendenciesPanel"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

const tendencies = {
  team: "BUF",
  tendencies: [
    {
      key: "dropback_rate",
      label: "Dropback Rate",
      value: 64.2,
      rank: 3,
      teams: 32,
      league_average: 60.9,
    },
    {
      key: "no_huddle_rate",
      label: "No-Huddle Rate",
      value: 1.1,
      rank: 31,
      teams: 32,
      league_average: 6.2,
    },
  ],
}

describe("TeamTendenciesPanel", () => {
  beforeEach(() => {
    mockApi({ "/teams/BUF/tendencies": tendencies })
  })

  it("shows each rate with its rank and the league average", async () => {
    renderWithRouter(<TeamTendenciesPanel teamAbbr="BUF" />)

    const panel = (await screen.findByRole("heading", { name: "Play Calling" })).closest("section")!
    expect(within(panel).getByText("Dropback Rate")).toBeInTheDocument()
    expect(within(panel).getByText("64.2%")).toBeInTheDocument()
    expect(within(panel).getByText("3rd")).toBeInTheDocument()
    expect(within(panel).getByText("60.9%")).toBeInTheDocument()
  })

  it("renders an ordinal that isn't just 'th'", async () => {
    renderWithRouter(<TeamTendenciesPanel teamAbbr="BUF" />)

    expect(await screen.findByText("31st")).toBeInTheDocument()
  })

  it("explains what the two figures beside and below each rate are", async () => {
    renderWithRouter(<TeamTendenciesPanel teamAbbr="BUF" />)

    expect(await screen.findByText(/rank among the 32 teams/)).toBeInTheDocument()
    expect(screen.getByText(/the league average/)).toBeInTheDocument()
  })

  it("reports a failed load", async () => {
    renderWithRouter(<TeamTendenciesPanel teamAbbr="NYJ" />)

    expect(await screen.findByText(/Couldn't load play calling/)).toBeInTheDocument()
  })
})
