// StatLeadersPanel.test.tsx
// Tests for the leaders panel: the top-5 cutoff, and the expanded view showing
// every player while keeping the panel's current sort, and the headshot row's
// movement arrows.
import { fireEvent, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LEADER_CATEGORIES } from "../data/leaderCategories"
import { weeklyLeaderPath } from "../data/leaderMovement"
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

// Week 1 had QB 2 ahead of QB 1 and nobody else on the board; week 2 is the newest.
const weekOne = [
  { player_id: "Q1", week: 1, passing_yards: 100 },
  { player_id: "Q2", week: 1, passing_yards: 500 },
]

function renderPanel(props: { expandable?: boolean; layout?: "table" | "headshots" } = {}) {
  mockApi({
    "/teams": [{ team_abbr: "DAL", team_name: "Dallas", team_logo_espn: "", team_color: "#123456", team_color2: "#654321" }],
    "/players?sort=-passing_yards&fields=player_id%2Cplayer_display_name%2Crecent_team%2Cheadshot_url%2Ccompletions%2Cattempts%2Cpassing_yards%2Cpassing_tds%2Cpassing_interceptions%2Cfumbles_lost_total&position_group=QB":
      players,
    [weeklyLeaderPath(LEADER_CATEGORIES[0])]: weekOne,
    "/players/latest-week": { season: 2026, week: 2, season_type: "REG" },
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

    it("numbers the leaders 1-5 in order", async () => {
      renderPanel({ layout: "headshots", expandable: false })
      expect(await screen.findByText("QB 1")).toBeInTheDocument()

      const cards = screen.getAllByRole("link", { name: /QB \d/ })
      expect(cards.map((card) => card.firstElementChild?.textContent)).toEqual(["1", "2", "3", "4", "5"])
    })

    it("marks leaders who moved since last week", async () => {
      renderPanel({ layout: "headshots", expandable: false })

      expect(await screen.findByText("Up 1 spot since last week")).toBeInTheDocument()
      const card = (name: string) => screen.getByText(name).closest("a")!
      expect(card("QB 1")).toHaveTextContent("Up 1 spot since last week")
      expect(card("QB 2")).toHaveTextContent("Down 1 spot since last week")
      // QB 3-8 were tied at 3rd with no yards; QB 3 is still 3rd.
      expect(card("QB 3")).not.toHaveTextContent("since last week")
      expect(card("QB 5")).toHaveTextContent("Down 2 spots since last week")
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
