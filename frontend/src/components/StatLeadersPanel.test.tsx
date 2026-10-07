// StatLeadersPanel.test.tsx
// Tests for the leaders panel: the top-5 cutoff, and the expanded view showing
// every player while keeping the panel's current sort.
import { fireEvent, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { mockApi, renderWithRouter } from "../test/render"
import StatLeadersPanel from "./StatLeadersPanel"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

// Eight QBs so the pool is comfortably deeper than the 5 the panel shows.
// Passing yards descend; touchdowns ascend, so sorting by TD reverses the order.
const players = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
  player_id: `Q${n}`,
  player_display_name: `QB ${n}`,
  recent_team: "DAL",
  headshot_url: null,
  completions: 10,
  attempts: 20,
  passing_yards: (9 - n) * 100,
  passing_tds: n,
  passing_interceptions: 0,
  fumbles_lost_total: 0,
}))

function renderPanel(props: { expandable?: boolean; layout?: "table" | "headshots" } = {}) {
  mockApi({
    "/teams": [{ team_abbr: "DAL", team_name: "Dallas", team_logo_espn: "", team_color: "#123456", team_color2: "#654321" }],
    "/players?sort=-passing_yards&fields=player_id%2Cplayer_display_name%2Crecent_team%2Cheadshot_url%2Ccompletions%2Cattempts%2Cpassing_yards%2Cpassing_tds%2Cpassing_interceptions%2Cfumbles_lost_total&position_group=QB":
      players,
  })
  renderWithRouter(<StatLeadersPanel position="QB" expandable {...props} />)
}

function namesInOrder(container: HTMLElement): string[] {
  return within(container)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getByText(/^QB \d$/).textContent ?? "")
}

describe("StatLeadersPanel", () => {
  it("shows only the top 5 until expanded", async () => {
    renderPanel()
    expect(await screen.findByText("QB 1")).toBeInTheDocument()

    expect(screen.getAllByRole("row")).toHaveLength(6) // header + 5
    expect(screen.queryByText("QB 6")).not.toBeInTheDocument()
  })

  it("lists every player in the expanded view", async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole("button", { name: /show all/i }))

    const dialog = screen.getByRole("dialog")
    expect(namesInOrder(dialog)).toHaveLength(8)
    expect(within(dialog).getByText("QB 8")).toBeInTheDocument()
  })

  it("keeps the panel's sort when expanding", async () => {
    renderPanel()
    expect(await screen.findByText("QB 1")).toBeInTheDocument()

    // Sort by TD, which reverses the default passing-yards order.
    fireEvent.click(screen.getByRole("button", { name: /TD/ }))
    expect(namesInOrder(document.body)[0]).toBe("QB 8")

    fireEvent.click(screen.getByRole("button", { name: /show all/i }))

    expect(namesInOrder(screen.getByRole("dialog"))[0]).toBe("QB 8")
  })

  describe("headshots layout", () => {
    it("shows five leaders with only the headline stat", async () => {
      renderPanel({ layout: "headshots", expandable: false })
      expect(await screen.findByText("QB 1")).toBeInTheDocument()

      // One card per leader, each linking to that player.
      const cards = screen.getAllByRole("link", { name: /QB \d/ })
      expect(cards).toHaveLength(5)
      expect(screen.queryByRole("table")).not.toBeInTheDocument()

      // Passing yards is the headline, named once for the row; the other
      // table columns are dropped.
      expect(screen.getByText("800")).toBeInTheDocument() // QB 1's passing yards
      expect(screen.getByRole("link", { name: "Leaders - Passing Yards" })).toBeInTheDocument()
      expect(screen.queryByText("CMP%")).not.toBeInTheDocument()
    })

    it("links its title to the players page at this position", async () => {
      renderPanel({ layout: "headshots", expandable: false })
      expect(await screen.findByText("QB 1")).toBeInTheDocument()

      expect(screen.getByRole("link", { name: "Leaders - Passing Yards" })).toHaveAttribute(
        "href",
        "/players?position=QB",
      )
    })
  })
})
