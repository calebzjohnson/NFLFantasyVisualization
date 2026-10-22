// MatchupSlate.test.tsx
// Tests the week's slate: every game links into its own matchup, finals show
// the score, and the week pages without losing its place.
import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { mockApi, renderWithRouter } from "../test/render"
import MatchupSlate from "./MatchupSlate"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

const week6 = [
  {
    game_id: "2026_06_SEA_DEN",
    game_type: "REG",
    week: 6,
    gameday: "2026-10-12",
    weekday: "Monday",
    gametime: "20:15",
    away_team: "SEA",
    away_score: 14,
    home_team: "DEN",
    home_score: 17,
    status: "final",
  },
  {
    game_id: "2026_06_HOU_JAX",
    game_type: "REG",
    week: 6,
    gameday: "2026-10-18",
    weekday: "Sunday",
    gametime: "09:30",
    away_team: "HOU",
    away_score: null,
    home_team: "JAX",
    home_score: null,
    status: "scheduled",
  },
]

function renderSlate(week: number | null, onWeekChange = vi.fn()) {
  mockApi({ "/scores?week=6": week6, "/scores": week6, "/teams": [] })
  renderWithRouter(
    <MatchupSlate week={week} onWeekChange={onWeekChange} minWeek={1} maxWeek={18} />,
  )
  return onWeekChange
}

describe("MatchupSlate", () => {
  it("links every game into its own matchup", async () => {
    renderSlate(6)

    const links = await screen.findAllByRole("link")
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/matchups/2026_06_SEA_DEN",
      "/matchups/2026_06_HOU_JAX",
    ])
  })

  it("shows a final's score and an upcoming game's kickoff", async () => {
    renderSlate(6)

    expect(await screen.findByText("Final")).toBeInTheDocument()
    expect(screen.getByText("17")).toBeInTheDocument()
    expect(screen.getByText(/^Sun /)).toBeInTheDocument()
  })

  it("orders the slate by kickoff, not by the payload", async () => {
    renderSlate(6)

    const links = await screen.findAllByRole("link")
    // Monday the 12th kicks off before Sunday the 18th.
    expect(links[0]).toHaveAttribute("href", "/matchups/2026_06_SEA_DEN")
  })

  it("pages the week", async () => {
    const onWeekChange = renderSlate(6)
    await screen.findByText("Final")

    fireEvent.click(screen.getByRole("button", { name: /Next/ }))

    expect(onWeekChange).toHaveBeenCalledWith(7)
  })

  it("takes the week from the games when the URL doesn't name one", async () => {
    const onWeekChange = renderSlate(null)

    expect(await screen.findByText("Week 6")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Prev/ }))
    expect(onWeekChange).toHaveBeenCalledWith(5)
  })

  it("reports a failed load", async () => {
    mockApi({ "/teams": [] })
    renderWithRouter(
      <MatchupSlate week={9} onWeekChange={vi.fn()} minWeek={1} maxWeek={18} />,
    )

    expect(await screen.findByText(/Couldn't load games/)).toBeInTheDocument()
  })
})
