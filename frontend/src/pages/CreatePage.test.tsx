// CreatePage.test.tsx
// Tests for the chart builder: the empty hint, a chart rebuilt from a shared URL, adding and removing picks, stats a mix of positions doesn't share, unchartable positions, and that switching between players and teams starts over.
import { fireEvent, screen, within } from "@testing-library/react"
import { useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { playersPathForPosition, playersWeeklyPathForPosition } from "../data/playerMetrics"
import { SEARCH_PLAYERS_PATH } from "../data/search"
import { playerBio, teamInfo } from "../test/fixtures"
import { mockApi, renderWithRouter } from "../test/render"
import CreatePage from "./CreatePage"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

function player(id: string, name: string, team: string) {
  return { player_id: id, player_display_name: name, recent_team: team, headshot_url: null }
}

beforeEach(() => {
  mockApi({
    [SEARCH_PLAYERS_PATH]: [
      { player_id: "P1", player_display_name: "Wide One", recent_team: "BUF", position: "WR" },
      { player_id: "P2", player_display_name: "Run Two", recent_team: "KC", position: "RB" },
      { player_id: "P3", player_display_name: "Long Snap", recent_team: "KC", position: "LS" },
      { player_id: "P4", player_display_name: "Edge Four", recent_team: "KC", position: "DE" },
      { player_id: "P5", player_display_name: "Back Up", recent_team: "KC", position: "WR" },
    ],
    "/players/P1/bio": playerBio({ player_id: "P1", position_group: "WR" }),
    "/players/P2/bio": playerBio({ player_id: "P2", position_group: "RB" }),
    "/players/P3/bio": playerBio({ player_id: "P3", position_group: "LS" }),
    "/players/P4/bio": playerBio({ player_id: "P4", position_group: "EDGE" }),
    [playersPathForPosition("EDGE")]: [],
    "/players/P5/bio": playerBio({ player_id: "P5", position_group: "WR" }),
    "/players/latest-week": { season: 2026, week: 6, season_type: "REG" },
    [playersPathForPosition("WR")]: [
      { ...player("P1", "Wide One", "BUF"), targets: 50, fantasy_points_ppr: 120 },
      // Under the WR floor at week 6 (2 targets a week: 12).
      { ...player("P5", "Back Up", "KC"), targets: 3, fantasy_points_ppr: 9 },
    ],
    [playersPathForPosition("RB")]: [{ ...player("P2", "Run Two", "KC"), targets: 20, fantasy_points_ppr: 90 }],
    [playersWeeklyPathForPosition("WR")]: [
      { player_id: "P1", player_display_name: "Wide One", team: "BUF", headshot_url: null, week: 1, targets: 8 },
    ],
    // DET has no games here, for the radar's third pick.
    "/teams": [teamInfo("BUF"), teamInfo("KC"), teamInfo("DET")],
    "/teams/weekly": [
      { team: "BUF", week: 1, week_complete: true, points_for: 20 },
      { team: "BUF", week: 2, week_complete: true, points_for: 31 },
      { team: "KC", week: 1, week_complete: true, points_for: 17 },
    ],
  })
})

// Shows the current URL's query, to check what the page writes back to it.
function Search() {
  return <output aria-label="URL query">{useLocation().search}</output>
}

function renderAt(route: string) {
  renderWithRouter(
    <>
      <CreatePage />
      <Search />
    </>,
    { route },
  )
}

const urlQuery = () => new URLSearchParams(screen.getByLabelText("URL query").textContent ?? "")

describe("CreatePage", () => {
  it("asks for picks before drawing anything", () => {
    renderAt("/create")
    expect(screen.getByText("Add up to 5 players above to build a chart.")).toBeInTheDocument()
    expect(screen.getByText("Add a player to see the stats you can chart.")).toBeInTheDocument()
  })

  it("rebuilds a bar chart from the URL, leaving out a stat the positions don't share", async () => {
    renderAt("/create?kind=players&type=bar&ids=P1,P2&stats=targets,carries")

    const targets = await screen.findByRole("region", { name: "Targets" })
    const [wide, run] = within(targets).getAllByRole("listitem")
    expect(wide).toHaveTextContent("Wide One50")
    expect(run).toHaveTextContent("Run Two20")
    expect(screen.queryByRole("region", { name: "Carries" })).not.toBeInTheDocument()
    expect(screen.getByText("Not tracked for every pick's position, so left out: Carries.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Targets" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: "Carries" })).not.toBeInTheDocument()
  })

  it("explains the charted stats, bar or line", async () => {
    renderAt("/create?ids=P1&stats=targets,fantasy_points_ppr")
    await screen.findByRole("region", { name: "Targets" })
    const terms = () => screen.getAllByRole("term").map((term) => term.textContent)
    expect(screen.getByText("What do these stats mean?")).toBeInTheDocument()
    expect(terms()).toEqual(["Targets: ", "Fantasy Points (PPR): "])
    expect(screen.getByText("Passes thrown his way, caught or not.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Line" }))
    await screen.findByRole("figure", { name: /^Targets by Week/ })
    expect(terms()).toEqual(["Targets: "])
  })

  it("defaults to fantasy points and adds stats up to the limit", async () => {
    renderAt("/create?ids=P1")

    expect(await screen.findByRole("region", { name: "Fantasy Points (PPR)" })).toHaveTextContent("Wide One120")
    fireEvent.click(screen.getByRole("button", { name: "Targets" }))
    expect(urlQuery().get("stats")).toBe("fantasy_points_ppr,targets")
  })

  it("can turn every stat off, one at a time or all at once, leaving an empty chart", async () => {
    renderAt("/create?ids=P1&stats=targets,fantasy_points_ppr")
    await screen.findByRole("region", { name: "Targets" })

    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(urlQuery().get("stats")).toBe("")
    expect(screen.getByText("No stats picked. Choose up to 4 above to compare.")).toBeInTheDocument()
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Targets" }))
    fireEvent.click(screen.getByRole("button", { name: "Targets" }))
    expect(screen.getByText("No stats picked. Choose up to 4 above to compare.")).toBeInTheDocument()
  })

  it("adds a pick from the search box and removes it from its chip", async () => {
    renderAt("/create")
    const search = screen.getByRole("combobox", { name: "Add a player..." })
    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: "wide" } })
    fireEvent.click(await screen.findByRole("option", { name: /Wide One/ }))

    expect(urlQuery().get("ids")).toBe("P1")
    // A pick isn't offered again.
    fireEvent.change(search, { target: { value: "wide" } })
    expect(await screen.findByText("No players found")).toBeInTheDocument()
    expect(await screen.findByRole("region", { name: "Fantasy Points (PPR)" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Remove Wide One" }))
    expect(urlQuery().get("ids")).toBeNull()
  })

  it("says when a pick's position has no stats to chart", async () => {
    renderAt("/create?ids=P3")
    expect(await screen.findByText("No stats to chart for Long Snap.")).toBeInTheDocument()
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })

  it("says when the picks' positions share no stats", async () => {
    renderAt("/create?ids=P1,P4")
    expect(await screen.findByText("These positions don't share any stats. Remove a player to chart the rest.")).toBeInTheDocument()
    expect(screen.getByText("No stat is tracked for all of these positions.")).toBeInTheDocument()
  })

  it("picks a line chart's one stat from a menu", async () => {
    renderAt("/create?type=line&ids=P1&stats=targets")
    expect(await screen.findByRole("figure", { name: /^Targets by Week/ })).toBeInTheDocument()
    fireEvent.change(screen.getByRole("combobox", { name: "Stat" }), { target: { value: "fantasy_points_ppr" } })
    expect(urlQuery().get("stats")).toBe("fantasy_points_ppr")
  })

  it("draws a line per picked team over the season", async () => {
    renderAt("/create?kind=teams&type=line&ids=BUF&stats=points")

    expect(
      await screen.findByRole("figure", {
        name: "Points / Game by Week: points / game each week for the 1 team you picked, week 1 to week 2.",
      }),
    ).toBeInTheDocument()
    const table = screen.getByRole("table")
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Team", "Wk 1", "Wk 2"])
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("BUF Team2031")
  })

  it("offers all five chart types", () => {
    renderAt("/create")
    const types = within(screen.getByRole("group", { name: "Chart type" })).getAllByRole("button")
    expect(types.map((button) => button.textContent)).toEqual(["Bar", "Line", "Scatter", "Beeswarm", "Radar"])
  })

  it("draws a radar of the picks' percentiles, and asks for a third stat with only two", async () => {
    renderAt("/create?kind=teams&type=radar&ids=BUF,KC&stats=points,turnovers,yards")

    expect(
      await screen.findByRole("figure", {
        name: "Radar of BUF Team, KC Team on 3 stats, as percentile ranks among all teams this season; further out is better, and the dashed ring is the 50th percentile.",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("Stats (3 to 6)")).toBeInTheDocument()
    const [, ...rows] = within(screen.getByRole("table")).getAllByRole("row")
    expect(rows.map((row) => row.textContent)).toEqual([
      "Points / Game25.5 (100th)17 (50th)",
      "Turnovers / Game0 (75th)0 (75th)",
      "Yards / Game0 (75th)0 (75th)",
    ])

    fireEvent.click(screen.getByRole("button", { name: "Yards / Game" }))
    expect(screen.getByText("Pick at least 3 stats to draw a radar.")).toBeInTheDocument()
  })

  it("rebuilds a scatter from the URL with the picks pinned, and sets its axes from the form", async () => {
    renderAt("/create?type=scatter&ids=P1,P2&stats=targets,fantasy_points_ppr")

    expect(
      await screen.findByRole("figure", {
        name: /^Fantasy Points \(PPR\) vs\. Targets: 3 players plotted .* Picked: Wide One, Run Two\.$/,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Picks" })).toHaveTextContent("Wide OneRun Two")
    expect(screen.getByLabelText("X axis")).toHaveValue("targets")

    fireEvent.change(screen.getByLabelText("Y axis"), { target: { value: "receptions" } })
    expect(urlQuery().get("stats")).toBe("targets,receptions")
  })

  it("ranks players on a beeswarm only against those over their position's volume floor", async () => {
    renderAt("/create?type=beeswarm&ids=P1&stats=targets")

    expect(
      await screen.findByRole("figure", {
        name: "Qualifying WRs this season (1), placed by percentile rank on each of 1 stats. Picked: Wide One.",
      }),
    ).toBeInTheDocument()
    expect(within(screen.getByRole("table")).queryByText("Back Up")).not.toBeInTheDocument()
    expect(screen.getByText(/WRs need 12 targets so far \(2 a week\) to be ranked\./)).toBeInTheDocument()
  })

  it("keeps a pick under the floor on the beeswarm, and says so", async () => {
    renderAt("/create?type=beeswarm&ids=P1,P5&stats=targets")

    await screen.findByRole("figure", { name: /^Qualifying WRs this season \(2\)/ })
    expect(within(screen.getByRole("table")).getByText("Back Up")).toBeInTheDocument()
    expect(screen.getByText(/WRs need 12 targets so far \(2 a week\) to be ranked; Back Up is under that but shown anyway\./)).toBeInTheDocument()
  })

  it("ranks teams on a beeswarm of the picked stats, with the picks pinned", async () => {
    renderAt("/create?kind=teams&type=beeswarm&ids=BUF&stats=points,turnovers")

    expect(
      await screen.findByRole("figure", {
        name: "All 2 teams this season, placed by percentile rank on each of 2 stats. Picked: BUF Team.",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("Stats (up to 6)")).toBeInTheDocument()
    // BUF scores more per game (100th); with no turnovers in the data, the two tie.
    const [, ...rows] = within(screen.getByRole("table")).getAllByRole("row")
    expect(rows.map((row) => row.textContent)).toEqual(["BUF Team25.5 (100th)0 (75th)", "KC Team17 (50th)0 (75th)"])
  })

  it("draws only the first two picks on a radar, and says so", async () => {
    renderAt("/create?kind=teams&type=radar&ids=BUF,KC,DET&stats=points,turnovers,yards")

    await screen.findByRole("figure", { name: /^Radar of BUF Team, KC Team on 3 stats/ })
    expect(screen.getByRole("list", { name: "Picks" })).toHaveTextContent("BUF TeamKC Team")
    expect(
      screen.getByText("The radar compares 2 at a time, so it shows BUF Team and KC Team. Remove a pick to swap another in."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Add a team..." })).not.toBeInTheDocument()
    expect(screen.getByText("Up to 2 teams on a radar.")).toBeInTheDocument()

    // The third pick is still there for the other charts.
    fireEvent.click(screen.getByRole("button", { name: "Bar" }))
    expect(urlQuery().get("ids")).toBe("BUF,KC,DET")
  })

  it("starts over when switching between players and teams", async () => {
    renderAt("/create?kind=players&ids=P1&stats=targets")
    await screen.findByRole("region", { name: "Targets" })

    fireEvent.click(screen.getByRole("button", { name: "Teams" }))
    expect(Object.fromEntries(urlQuery())).toEqual({ kind: "teams", type: "bar" })
    expect(screen.getByText("Add up to 5 teams above to build a chart.")).toBeInTheDocument()
  })
})
