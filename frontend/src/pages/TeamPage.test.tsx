// TeamPage.test.tsx
// Tests for the team page: header and game log from the API, case-insensitive URLs, and unknown teams.
import { screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { teamInfo, teamRecord } from "../test/fixtures"
import { mockApi, renderWithRouter } from "../test/render"
import TeamPage from "./TeamPage"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

function renderTeamPage(route: string) {
  renderWithRouter(<TeamPage />, { route, path: "/teams/:teamAbbr" })
}

describe("TeamPage", () => {
  beforeEach(() => {
    mockApi({
      "/teams": [teamInfo("BUF", { team_name: "Buffalo Bills" }), teamInfo("MIA")],
      "/standings": [
        { division: "AFC East", teams: [teamRecord("BUF", { wins: 2 }), teamRecord("MIA", { losses: 2 })] },
      ],
      "/teams/weekly": [
        { team: "BUF", week: 2, opponent_team: "NYJ", points_for: 30, points_against: 20 },
        { team: "BUF", week: 1, opponent_team: "MIA", points_for: 24, points_against: 10 },
        { team: "MIA", week: 1, opponent_team: "BUF", points_for: 10, points_against: 24 },
      ],
    })
  })

  it("shows the team's header and its own game log, oldest week first", async () => {
    renderTeamPage("/teams/BUF")

    expect(await screen.findByRole("heading", { name: "Buffalo Bills" })).toBeInTheDocument()
    expect(await screen.findByText("2-0 · 1st in AFC East")).toBeInTheDocument()

    const log = await screen.findByRole("table")
    const [, week1, week2, total] = within(log).getAllByRole("row")
    expect(within(week1).getByText("MIA")).toBeInTheDocument()
    expect(within(week2).getByText("NYJ")).toBeInTheDocument()
    expect(within(total).getByText("54")).toBeInTheDocument()
  })

  it("accepts a lowercase abbreviation", async () => {
    renderTeamPage("/teams/buf")
    expect(await screen.findByRole("heading", { name: "Buffalo Bills" })).toBeInTheDocument()
  })

  it("says so when no team matches the URL", async () => {
    renderTeamPage("/teams/XYZ")
    expect(await screen.findByText("No team found for “XYZ”.")).toBeInTheDocument()
  })
})
