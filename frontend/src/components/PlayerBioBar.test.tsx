// PlayerBioBar.test.tsx
// Tests for the player header: identity line, team page link, and free agents.
import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { PlayerBio } from "../data/playerBio"
import { teamInfo } from "../test/fixtures"
import { renderWithRouter } from "../test/render"
import PlayerBioBar from "./PlayerBioBar"

const bio: PlayerBio = {
  player_id: "Q1",
  display_name: "Q One",
  position: "QB",
  team: "KC",
  jersey_number: "15",
  height_in: null,
  weight_lb: null,
  birth_date: null,
  college: null,
  status: null,
  draft_year: null,
  draft_round: null,
  draft_pick: null,
  draft_team: null,
  headshot_url: null,
}

describe("PlayerBioBar", () => {
  it("links the player's team to its team page", () => {
    renderWithRouter(<PlayerBioBar bio={bio} team={teamInfo("KC", { team_name: "Kansas City Chiefs" })} />)

    expect(screen.getByRole("heading", { name: "Q One" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Kansas City Chiefs" })).toHaveAttribute("href", "/teams/KC")
    expect(screen.getByText("· #15")).toBeInTheDocument()
  })

  it("shows a player with no team as a free agent, without a link", () => {
    renderWithRouter(<PlayerBioBar bio={{ ...bio, team: null }} team={null} />)

    expect(screen.getByText("Free Agent")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
