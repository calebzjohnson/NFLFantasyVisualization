// LeagueBeeswarm.test.tsx
// Tests the league beeswarm's tooltip, pool requests, prompts, focus and volume states, and its highlight search, for players and teams.
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchJson } from "../lib/api"
import { teamInfo } from "../test/fixtures"
import { mockApi, renderWithRouter } from "../test/render"
import LeagueBeeswarm, { SwarmTooltip, type SwarmPoint } from "./LeagueBeeswarm"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

afterEach(() => {
  vi.unstubAllGlobals()
})

function point(value: number | null): SwarmPoint {
  const row = { id: "p1", name: "Jane Doe", team: "KC", axes: [] }
  return { row, axisIndex: 0, axisLabel: "EPA/Dropback", value, x: 0, y: 82.4 }
}

describe("SwarmTooltip", () => {
  it("shows the name, team, stat value, and percentile", () => {
    render(<SwarmTooltip active payload={[{ payload: point(0.21) }]} showTeam />)
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    expect(screen.getByText("· KC")).toBeInTheDocument()
    expect(screen.getByText("EPA/Dropback")).toBeInTheDocument()
    expect(screen.getByText("0.21")).toBeInTheDocument()
    expect(screen.getByText("82nd")).toBeInTheDocument()
  })

  it("leaves the team off for a team's own dot, and dashes a missing value", () => {
    render(<SwarmTooltip active payload={[{ payload: point(null) }]} showTeam={false} />)
    expect(screen.queryByText("· KC")).not.toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument()
  })
})

const TEAMS = [teamInfo("KC", { team_name: "Kansas City Chiefs" }), teamInfo("BUF", { team_name: "Buffalo Bills" })]

// Separate positions per test: useFetch caches each path for the whole file.
function playerPool(position: string) {
  const axes = [{ key: "epa", value: 0.2, percentile: 80 }]
  return {
    "/teams": TEAMS,
    [`/players/radar-pool?position=${position}`]: {
      position,
      axes: [{ key: "epa", label: "EPA / Dropback" }],
      players: [
        { player_id: "p1", name: "Jane Doe", team: "KC", axes },
        { player_id: "p2", name: "Sam Roe", team: "BUF", axes },
      ],
    },
  }
}

describe("LeagueBeeswarm", () => {
  it("encodes the position in the pool request", async () => {
    mockApi({})
    renderWithRouter(<LeagueBeeswarm kind="players" position="W/R?x=1#y" />)
    await waitFor(() => expect(fetchJson).toHaveBeenCalledWith("/players/radar-pool?position=W%2FR%3Fx%3D1%23y"))
  })

  // pt-2 matches MetricScatter's caption, so both sit the same distance below the tap box.
  it("on a touchscreen phone, prompts a tap and says to swipe for every stat", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    mockApi(playerPool("QB"))
    renderWithRouter(<LeagueBeeswarm kind="players" position="QB" />)
    expect(await screen.findByText("Tap a dot to see that player's numbers.")).toBeInTheDocument()
    expect(screen.getByText(/Tap a dot to highlight that player in every column/)).toBeInTheDocument()
    expect(screen.getByText(/Swipe the chart sideways to see all 1 stats\./)).toHaveClass("pt-2")
  })

  it("with a mouse on a wide screen, says to click instead", async () => {
    mockApi(playerPool("RB"))
    renderWithRouter(<LeagueBeeswarm kind="players" position="RB" />)
    expect(await screen.findByText(/Click a dot to highlight that player in every column/)).toBeInTheDocument()
    expect(screen.queryByText(/^Tap a dot/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Swipe/)).not.toBeInTheDocument()
  })

  it("highlights a searched player, naming them in the chart's label", async () => {
    mockApi(playerPool("WR"))
    renderWithRouter(<LeagueBeeswarm kind="players" position="WR" />)
    const search = await screen.findByLabelText("Highlight")
    expect(screen.getByRole("figure", { name: /^Every qualifying WR this season \(2\), .*stats\.$/ })).toBeInTheDocument()

    fireEvent.change(search, { target: { value: "Sam Roe · BUF" } })
    expect(screen.getByRole("figure", { name: /Highlighted: Sam Roe\.$/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Stop highlighting Sam Roe · BUF" }))
    expect(screen.getByRole("figure", { name: /stats\.$/ })).toBeInTheDocument()
  })

  it("names the page's own player as the one in team color", async () => {
    mockApi(playerPool("TE"))
    renderWithRouter(<LeagueBeeswarm kind="players" position="TE" focusId="p1" />)
    expect(await screen.findByRole("figure", { name: /with Jane Doe in team color\.$/ })).toBeInTheDocument()
  })

  it("explains a missing chart when the page's player isn't in the pool", async () => {
    mockApi(playerPool("CB"))
    renderWithRouter(<LeagueBeeswarm kind="players" position="CB" focusId="nobody" />)
    expect(await screen.findByText("Not enough season volume yet for a league comparison.")).toBeInTheDocument()
    expect(screen.queryByLabelText("Highlight")).not.toBeInTheDocument()
  })

  it("plots every team by full name and searches by it", async () => {
    mockApi({
      "/teams": TEAMS,
      "/teams/radar-pool": {
        axes: [{ key: "off_pass_epa", label: "Pass Offense" }],
        teams: [
          { team: "KC", axes: [{ key: "off_pass_epa", value: 0.1, percentile: 60 }] },
          { team: "BUF", axes: [{ key: "off_pass_epa", value: 0.2, percentile: 90 }] },
        ],
      },
    })
    renderWithRouter(<LeagueBeeswarm kind="teams" />)
    const search = await screen.findByLabelText("Highlight")
    expect(screen.getByRole("figure", { name: /^All 2 teams this season/ })).toBeInTheDocument()
    expect(screen.getByRole("table")).toHaveTextContent("Buffalo Bills")

    fireEvent.change(search, { target: { value: "Buffalo Bills" } })
    expect(screen.getByRole("figure", { name: /Highlighted: Buffalo Bills\.$/ })).toBeInTheDocument()
  })
})
