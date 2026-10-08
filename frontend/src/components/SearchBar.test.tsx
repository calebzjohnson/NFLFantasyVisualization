// SearchBar.test.tsx
// Tests for the search bar in each scope (results, grouping, links, empty state, fetches) and its
// combobox keyboard behavior: arrow keys, Enter, Escape, Tab into results, and mouse selection.
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchJson } from "../lib/api"
import type { SearchScope } from "../data/search"
import { teamInfo } from "../test/fixtures"
import { mockApi } from "../test/render"
import SearchBar from "./SearchBar"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

const PLAYERS_PATH = "/players?fields=player_id,player_display_name,recent_team,position"

// Real routes behind the search bar, so navigation is visible as the page that renders.
function renderSearch(scope: SearchScope, placeholder = "Search...") {
  render(
    <MemoryRouter>
      <SearchBar placeholder={placeholder} scope={scope} />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/players/:playerId" element={<p>Player page</p>} />
        <Route path="/teams/:teamAbbr" element={<p>Team page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const combobox = () => screen.getByRole("combobox")

function type(query: string) {
  fireEvent.focus(combobox())
  fireEvent.change(combobox(), { target: { value: query } })
}

const key = (name: string) => fireEvent.keyDown(combobox(), { key: name })

describe("SearchBar", () => {
  beforeEach(() => {
    vi.mocked(fetchJson).mockReset()
    mockApi({
      [PLAYERS_PATH]: [
        { player_id: "P1", player_display_name: "Josh Allen", recent_team: "BUF", position: "QB" },
        { player_id: "P2", player_display_name: "Bo Nix", recent_team: "DEN", position: "QB" },
        { player_id: "P3", player_display_name: "Josh Jacobs", recent_team: "GB", position: "RB" },
      ],
      "/teams": [teamInfo("BUF", { team_name: "Buffalo Bills" })],
    })
  })

  it("finds players and links to their page", async () => {
    renderSearch("players")
    type("allen")
    expect(await screen.findByRole("option", { name: /Josh Allen/ })).toHaveAttribute("href", "/players/P1")
  })

  it("finds teams and links to their page, without fetching players", async () => {
    renderSearch("teams")
    type("bills")

    expect(await screen.findByRole("option", { name: /Buffalo Bills/ })).toHaveAttribute("href", "/teams/BUF")
    expect(fetchJson).not.toHaveBeenCalledWith(PLAYERS_PATH)
  })

  it("groups an all search into Teams then Players", async () => {
    renderSearch("all")
    type("b")

    // Both lists load independently; wait for each.
    await screen.findByRole("option", { name: /Buffalo Bills/ })
    await screen.findByRole("option", { name: /Bo Nix/ })
    const [first, second] = screen.getAllByRole("group")
    expect(first).toBe(screen.getByRole("group", { name: "Teams" }))
    expect(second).toBe(screen.getByRole("group", { name: "Players" }))
    expect(first).toContainElement(screen.getByRole("option", { name: /Buffalo Bills/ }))
    expect(second).toContainElement(screen.getByRole("option", { name: /Bo Nix/ }))
  })

  it("says when nothing matches", async () => {
    renderSearch("teams")
    type("zzz")
    expect(await screen.findByRole("status")).toHaveTextContent("No teams found")
    expect(combobox()).toHaveAttribute("aria-expanded", "false")
  })

  it("clears the query and navigates when a result is clicked", async () => {
    renderSearch("teams")
    type("bills")
    const option = await screen.findByRole("option", { name: /Buffalo Bills/ })

    // The mousedown must not move focus out of the input (which would close the list first).
    expect(fireEvent.mouseDown(option)).toBe(false) // default prevented
    fireEvent.click(option)

    expect(combobox()).toHaveValue("")
    expect(screen.getByText("Team page")).toBeInTheDocument()
  })

  describe("combobox keyboard", () => {
    it("exposes the listbox to assistive tech while results are shown", async () => {
      renderSearch("players")
      expect(combobox()).toHaveAttribute("aria-expanded", "false")

      type("josh")
      await screen.findByRole("option", { name: /Josh Jacobs/ })

      expect(combobox()).toHaveAttribute("aria-expanded", "true")
      expect(combobox()).toHaveAttribute("aria-controls", screen.getByRole("listbox").id)
      expect(combobox()).not.toHaveAttribute("aria-activedescendant")
    })

    it("moves the active option with the arrow keys, wrapping at the ends", async () => {
      renderSearch("players")
      type("josh") // Josh Allen, then Josh Jacobs
      const [allen, jacobs] = await Promise.all([
        screen.findByRole("option", { name: /Josh Allen/ }),
        screen.findByRole("option", { name: /Josh Jacobs/ }),
      ])

      key("ArrowDown")
      expect(combobox()).toHaveAttribute("aria-activedescendant", allen.id)
      expect(allen).toHaveAttribute("aria-selected", "true")

      key("ArrowDown")
      expect(combobox()).toHaveAttribute("aria-activedescendant", jacobs.id)
      expect(allen).toHaveAttribute("aria-selected", "false")

      key("ArrowDown") // wraps to the top
      expect(combobox()).toHaveAttribute("aria-activedescendant", allen.id)

      key("ArrowUp") // wraps to the bottom
      expect(combobox()).toHaveAttribute("aria-activedescendant", jacobs.id)
    })

    it("opens the active option with Enter", async () => {
      renderSearch("players")
      type("josh")
      await screen.findByRole("option", { name: /Josh Jacobs/ })

      key("ArrowDown")
      key("ArrowDown") // Josh Jacobs
      key("Enter")

      expect(screen.getByText("Player page")).toBeInTheDocument()
      expect(combobox()).toHaveValue("")
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    })

    it("opens the first match with Enter when nothing is active", async () => {
      renderSearch("teams")
      type("bills")
      await screen.findByRole("option", { name: /Buffalo Bills/ })

      key("Enter")

      expect(screen.getByText("Team page")).toBeInTheDocument()
    })

    it("closes with Escape but keeps the query", async () => {
      renderSearch("players")
      type("allen")
      await screen.findByRole("option", { name: /Josh Allen/ })

      key("Escape")

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
      expect(combobox()).toHaveAttribute("aria-expanded", "false")
      expect(combobox()).toHaveValue("allen")

      key("ArrowDown") // reopens on the first result
      expect(screen.getByRole("option", { name: /Josh Allen/ })).toHaveAttribute("aria-selected", "true")
    })

    it("stays open when Tab moves focus into the results, and closes when focus leaves", async () => {
      renderSearch("players")
      type("allen")
      const option = await screen.findByRole("option", { name: /Josh Allen/ })

      // Tab from the input to the first result: focus stays inside the search bar.
      fireEvent.blur(combobox(), { relatedTarget: option })
      expect(screen.getByRole("listbox")).toBeInTheDocument()

      // Escape from a focused result closes the list and returns focus to the input.
      option.focus()
      fireEvent.keyDown(option, { key: "Escape" })
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
      expect(combobox()).toHaveFocus()

      // Focus leaving the component entirely closes it.
      key("ArrowDown")
      fireEvent.blur(combobox(), { relatedTarget: document.body })
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    })
  })
})
