// TeamPlaymakingPanel.test.tsx
// Tests the Playmaking tab: leaders and their stat toggle, both share charts
// rendering with nobody singled out, and red zone shares.
import { fireEvent, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { teamInfo } from "../test/fixtures"
import { mockApi, renderWithRouter } from "../test/render"
import TeamPlaymakingPanel from "./TeamPlaymakingPanel"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

function usage(metric: string, label: string) {
  return {
    player_id: null,
    team: "BUF",
    metric,
    label,
    player_value: 0,
    team_value: 30,
    teammates: [
      { player_id: "P1", name: "P One", value: 20 },
      { player_id: "P2", name: "P Two", value: 10 },
    ],
    weekly: [
      {
        week: 1,
        team_value: 30,
        players: [
          { player_id: "P1", name: "P One", headshot_url: null, value: 20 },
          { player_id: "P2", name: "P Two", headshot_url: null, value: 10 },
        ],
      },
    ],
  }
}

function playmaking(overrides: Record<string, unknown> = {}) {
  return {
    team: "BUF",
    touches: usage("touches", "Backfield Split"),
    targets: usage("targets", "Target Split"),
    red_zone: {
      total: 20,
      players: [
        { player_id: "P1", name: "P One", headshot_url: null, touches: 10 },
        { player_id: "P2", name: "P Two", headshot_url: null, touches: 5 },
      ],
    },
    leaders: [
      {
        key: "receiving_yards",
        label: "Receiving Yards",
        players: [{ player_id: "P1", name: "P One", headshot_url: null, value: 140 }],
      },
      {
        key: "def_sacks",
        label: "Sacks",
        players: [{ player_id: "D1", name: "D One", headshot_url: null, value: 2.5 }],
      },
    ],
    ...overrides,
  }
}

function renderPanel() {
  renderWithRouter(<TeamPlaymakingPanel teamAbbr="BUF" />)
}

describe("TeamPlaymakingPanel", () => {
  beforeEach(() => {
    mockApi({
      "/teams": [teamInfo("BUF")],
      "/teams/BUF/playmaking": playmaking(),
    })
  })

  it("renders both share charts with nobody singled out", async () => {
    renderPanel()

    expect(
      await screen.findByRole("figure", {
        name: "This team's backfield split week by week, player by player.",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("figure", {
        name: "This team's target split week by week, player by player.",
      }),
    ).toBeInTheDocument()
  })

  it("names the metric on each share panel", async () => {
    renderPanel()

    expect(await screen.findByRole("heading", { name: "Backfield Split" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Target Split" })).toBeInTheDocument()
  })

  it("opens the leaders row on the first stat and switches on the toggle", async () => {
    renderPanel()

    const leaders = (await screen.findByRole("heading", { name: "Team Leaders" })).closest("section")!
    expect(within(leaders).getByRole("link", { name: /P One/ })).toBeInTheDocument()
    expect(within(leaders).getByText("140")).toBeInTheDocument()

    fireEvent.click(within(leaders).getByRole("button", { name: "Sacks" }))

    expect(within(leaders).getByRole("link", { name: /D One/ })).toBeInTheDocument()
    expect(within(leaders).getByText("2.5")).toBeInTheDocument()
  })

  it("shows each red zone player's share of the team's touches", async () => {
    renderPanel()

    const redZone = (await screen.findByRole("heading", { name: "Red Zone Touches" })).closest(
      "section",
    )!
    // Touches lead, with the share underneath.
    expect(within(redZone).getByText("10")).toBeInTheDocument()
    expect(within(redZone).getByText("50%")).toBeInTheDocument()
    expect(within(redZone).getByText("5")).toBeInTheDocument()
    expect(within(redZone).getByText("25%")).toBeInTheDocument()
    expect(within(redZone).getByText(/out of this team's 20/)).toBeInTheDocument()
  })

  it("says so when a team has no red zone touches yet", async () => {
    mockApi({
      "/teams": [teamInfo("MIA")],
      "/teams/MIA/playmaking": playmaking({ red_zone: { total: 0, players: [] } }),
    })
    renderWithRouter(<TeamPlaymakingPanel teamAbbr="MIA" />)

    expect(await screen.findByText(/No red zone touches recorded yet/)).toBeInTheDocument()
  })

  it("reports a failed load", async () => {
    renderWithRouter(<TeamPlaymakingPanel teamAbbr="NYJ" />)

    expect(await screen.findByText(/Couldn't load playmaking/)).toBeInTheDocument()
  })
})
