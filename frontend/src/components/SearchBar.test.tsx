// SearchBar.test.tsx
// Tests for the search bar in each scope: results, grouping, links, empty state, and what it fetches.
import { fireEvent, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchJson } from "../lib/api"
import { teamInfo } from "../test/fixtures"
import { mockApi, renderWithRouter } from "../test/render"
import SearchBar from "./SearchBar"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

const PLAYERS_PATH = "/players?fields=player_id,player_display_name,recent_team,position"

function type(query: string) {
  const input = screen.getByRole("searchbox")
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: query } })
}

describe("SearchBar", () => {
  beforeEach(() => {
    vi.mocked(fetchJson).mockReset()
    mockApi({
      [PLAYERS_PATH]: [
        { player_id: "P1", player_display_name: "Josh Allen", recent_team: "BUF", position: "QB" },
        { player_id: "P2", player_display_name: "Bo Nix", recent_team: "DEN", position: "QB" },
      ],
      "/teams": [teamInfo("BUF", { team_name: "Buffalo Bills" })],
    })
  })

  it("finds players and links to their page", async () => {
    renderWithRouter(<SearchBar placeholder="Search players..." scope="players" />)
    type("allen")
    expect(await screen.findByRole("link", { name: /Josh Allen/ })).toHaveAttribute("href", "/players/P1")
  })

  it("finds teams and links to their page, without fetching players", async () => {
    renderWithRouter(<SearchBar placeholder="Search teams..." scope="teams" />)
    type("bills")

    expect(await screen.findByRole("link", { name: /Buffalo Bills/ })).toHaveAttribute("href", "/teams/BUF")
    expect(fetchJson).not.toHaveBeenCalledWith(PLAYERS_PATH)
  })

  it("groups an all search into Teams then Players", async () => {
    renderWithRouter(<SearchBar placeholder="Search teams & players..." scope="all" />)
    type("b")

    // Both lists load independently; wait for each.
    await screen.findByRole("link", { name: /Buffalo Bills/ })
    await screen.findByRole("link", { name: /Bo Nix/ })
    const labels = screen.getAllByRole("listitem").map((item) => item.textContent)
    expect(labels[0]).toBe("Teams")
    expect(labels[2]).toBe("Players")
  })

  it("says when nothing matches", async () => {
    renderWithRouter(<SearchBar placeholder="Search teams..." scope="teams" />)
    type("zzz")
    expect(await screen.findByText("No teams found")).toBeInTheDocument()
  })

  it("clears the query after picking a result", async () => {
    renderWithRouter(<SearchBar placeholder="Search teams..." scope="teams" />)
    type("bills")
    fireEvent.click(await screen.findByRole("link", { name: /Buffalo Bills/ }))
    expect(screen.getByRole("searchbox")).toHaveValue("")
  })
})
