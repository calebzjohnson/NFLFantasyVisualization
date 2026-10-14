// TeamUsagePanel.test.tsx
// Two suites: that the charts prompt a tap on touchscreens rather than
// hovering, and that the panel's own views (weekly, season donut) render what
// they should.
// Tests that the usage charts prompt a tap on touchscreens (weekly: bars or dots/lines, by metric; season: slices) and not with a mouse.
// The chart's marks aren't tested here - recharts needs real layout, which jsdom lacks (see e2e/smoke.spec.ts).
import { fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { teamInfo } from "../test/fixtures"
import { mockApi, renderWithRouter } from "../test/render"
import TeamUsagePanel from "./TeamUsagePanel"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

// useFetch caches by path for the whole file, so each test uses its own player id.
function usage(metric: string, playerId: string) {
  return {
    player_id: playerId,
    team: "KC",
    metric,
    label: metric === "targets" ? "Target Share" : "TD Involvement",
    player_value: 5,
    team_value: 10,
    teammates: [{ player_id: "P2", name: "Teammate", value: 5 }],
    weekly: [
      {
        week: 1,
        team_value: 10,
        players: [
          { player_id: playerId, name: "Player", headshot_url: null, value: 5 },
          { player_id: "P2", name: "Teammate", headshot_url: null, value: 5 },
        ],
      },
    ],
  }
}

const touchscreen = () =>
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("TeamUsagePanel weekly chart", () => {
  it("prompts a tap on a bar for a share metric, on a touchscreen", async () => {
    touchscreen()
    mockApi({ "/players/P1/usage": usage("targets", "P1"), "/teams": [] })
    renderWithRouter(<TeamUsagePanel playerId="P1" playerName="Player" />)
    expect(await screen.findByText("Tap a bar to see that week's numbers.")).toBeInTheDocument()
  })

  it("prompts a tap on a dot or line for TD involvement, on a touchscreen", async () => {
    touchscreen()
    mockApi({ "/players/P3/usage": usage("td_involvement", "P3"), "/teams": [] })
    renderWithRouter(<TeamUsagePanel playerId="P3" playerName="Player" />)
    expect(await screen.findByText("Tap a dot or line to see the numbers.")).toBeInTheDocument()
  })

  it("prompts a tap on a slice in the season view, on a touchscreen", async () => {
    touchscreen()
    mockApi({ "/players/P5/usage": usage("targets", "P5"), "/teams": [] })
    renderWithRouter(<TeamUsagePanel playerId="P5" playerName="Player" />)
    fireEvent.click(await screen.findByRole("button", { name: /season/i }))
    expect(await screen.findByText("Tap a slice to see its numbers.")).toBeInTheDocument()
  })

  it("shows no tap prompt with a mouse", async () => {
    mockApi({ "/players/P4/usage": usage("targets", "P4"), "/teams": [] })
    renderWithRouter(<TeamUsagePanel playerId="P4" playerName="Player" />)
    expect(await screen.findByRole("figure")).toBeInTheDocument()
    expect(screen.queryByText(/^Tap a /)).not.toBeInTheDocument()
  })
})

function player(id: string, name: string, value: number) {
  return { player_id: id, name, headshot_url: null, value }
}

// Targets: the stacked-bar shape. W1 takes 40 of the team's 100.
function targetsUsage() {
  return {
    player_id: "W1",
    team: "KC",
    metric: "targets",
    label: "Target Share",
    player_value: 40,
    team_value: 100,
    teammates: [
      { player_id: "W2", name: "W Two", value: 35 },
      { player_id: "W3", name: "W Three", value: 25 },
    ],
    weekly: [
      {
        week: 1,
        team_value: 50,
        players: [player("W1", "W One", 20), player("W2", "W Two", 18), player("W3", "W Three", 12)],
      },
      {
        week: 2,
        team_value: 50,
        players: [player("W1", "W One", 20), player("W2", "W Two", 17), player("W3", "W Three", 13)],
      },
    ],
  }
}

// Touches: the multi-line shape, and a label with a "vs" the donut trims.
function touchesUsage() {
  return {
    player_id: "R1",
    team: "KC",
    metric: "touches",
    label: "Touch Share vs Backfield",
    player_value: 60,
    team_value: 80,
    teammates: [{ player_id: "R2", name: "R Two", value: 20 }],
    weekly: [
      { week: 1, team_value: 40, players: [player("R1", "R One", 30), player("R2", "R Two", 10)] },
      { week: 2, team_value: 40, players: [player("R1", "R One", 30), player("R2", "R Two", 10)] },
    ],
  }
}

function renderPanel(id: string, name: string) {
  renderWithRouter(<TeamUsagePanel playerId={id} playerName={name} />)
}

describe("TeamUsagePanel", () => {
  beforeEach(() => {
    mockApi({
      "/teams": [teamInfo("KC", { team_name: "Kansas City Chiefs" })],
      "/players/W1/usage": targetsUsage(),
      "/players/R1/usage": touchesUsage(),
    })
  })

  it("titles the panel with the metric the backend named", async () => {
    renderPanel("W1", "W One")

    expect(await screen.findByRole("heading", { name: "Target Share" })).toBeInTheDocument()
  })

  it("opens on the weekly view, naming the player in the chart's label", async () => {
    renderPanel("W1", "W One")

    expect(
      await screen.findByRole("figure", {
        name: "W One's share of the team's target share, week by week.",
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "weekly" })).toHaveAttribute("aria-pressed", "true")
  })

  it("renders the weekly view for a touches payload too", async () => {
    renderPanel("R1", "R One")

    expect(
      await screen.findByRole("figure", {
        name: "R One's share of the team's touch share vs backfield, week by week.",
      }),
    ).toBeInTheDocument()
  })

  it("shows the player's season share in the donut", async () => {
    renderPanel("W1", "W One")

    fireEvent.click(await screen.findByRole("button", { name: "season" }))

    // 40 of the team's 100 targets.
    expect(
      await screen.findByRole("figure", {
        name: "W One's share of the team's target share: 40%.",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("40%")).toBeInTheDocument()
  })

  it("trims the donut's caption at 'vs' so it fits the centre", async () => {
    renderPanel("R1", "R One")

    fireEvent.click(await screen.findByRole("button", { name: "season" }))

    expect(await screen.findByText("75%")).toBeInTheDocument()
    expect(screen.getByText("Touch Share")).toBeInTheDocument()
  })

  it("reports a failed load", async () => {
    renderPanel("XX", "Nobody")

    expect(await screen.findByText(/Couldn't load usage/)).toBeInTheDocument()
  })
})
