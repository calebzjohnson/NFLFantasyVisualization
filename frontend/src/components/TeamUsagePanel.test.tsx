// TeamUsagePanel.test.tsx
// Tests that the weekly usage chart prompts a tap on touchscreens (bars or dots/lines, by metric) and not with a mouse.
// The chart's marks aren't tested here - recharts needs real layout, which jsdom lacks (see e2e/smoke.spec.ts).
import { screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
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

  it("shows no tap prompt with a mouse", async () => {
    mockApi({ "/players/P4/usage": usage("targets", "P4"), "/teams": [] })
    renderWithRouter(<TeamUsagePanel playerId="P4" playerName="Player" />)
    expect(await screen.findByRole("figure")).toBeInTheDocument()
    expect(screen.queryByText(/^Tap a /)).not.toBeInTheDocument()
  })
})
