// TeamPage.tsx
// Individual team route (/teams/:teamAbbr): header bar, then a tabbed body -
// Overview (game log and comparison charts) or Depth Chart. The tab lives in
// the URL (?tab=depth-chart) so the browser's back button returns to it.
import { useParams, useSearchParams } from "react-router-dom"
import GameLogTable from "../components/GameLogTable"
import Panel from "../components/Panel"
import PositionGroupToggle from "../components/PositionGroupToggle"
import TeamDepthChartPanel from "../components/TeamDepthChartPanel"
import TeamHeaderBar from "../components/TeamHeaderBar"
import TeamPlaymakingPanel from "../components/TeamPlaymakingPanel"
import TeamLeagueComparisonBeeswarm from "../components/TeamLeagueComparisonBeeswarm"
import TeamRadarChart from "../components/TeamRadarChart"
import TeamScoringComposition from "../components/TeamScoringComposition"
import TeamTendenciesPanel from "../components/TeamTendenciesPanel"
import { findTeamStanding, type DivisionStanding } from "../data/standings"
import { teamGameLog, type TeamGameRow } from "../data/teamMetrics"
import type { TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"
import { usePageTitle } from "../lib/usePageTitle"

const TEAM_TABS = ["overview", "playmaking", "depth-chart"] as const
type TeamTab = (typeof TEAM_TABS)[number]

const TAB_LABELS: Record<TeamTab, string> = {
  overview: "Overview",
  playmaking: "Playmaking",
  "depth-chart": "Depth Chart",
}

function isTeamTab(value: string | null): value is TeamTab {
  return TEAM_TABS.includes(value as TeamTab)
}

function TeamPage() {
  const { teamAbbr = "" } = useParams<{ teamAbbr: string }>()
  const abbr = teamAbbr.toUpperCase()
  const [searchParams, setSearchParams] = useSearchParams()
  // The URL is user-editable, so anything unrecognized falls back to Overview.
  const param = searchParams.get("tab")?.toLowerCase() ?? null
  const tab = isTeamTab(param) ? param : TEAM_TABS[0]
  // replace: switching tabs updates the current history entry instead of
  // adding one, so Back leaves the page rather than stepping through tabs.
  const setTab = (next: TeamTab) => setSearchParams({ tab: next }, { replace: true })

  const teams = useFetch<TeamInfo[]>("/teams")
  const standings = useFetch<DivisionStanding[]>("/standings")
  const games = useFetch<TeamGameRow[]>("/teams/weekly")

  const team = teams.data?.find((t) => t.team_abbr === abbr)
  usePageTitle(team?.team_name ?? abbr)
  const standing = standings.data ? findTeamStanding(standings.data, abbr) : null
  const log = games.data && team ? teamGameLog(games.data, abbr) : null

  return (
    <div className="flex flex-col gap-6">
      {teams.loading && <p className="text-sm text-[var(--text-secondary)]">Loading…</p>}
      {teams.error && <p className="text-sm text-[var(--negative)]">Couldn't load team: {teams.error}</p>}
      {teams.data && !team && <p className="text-sm text-[var(--text-secondary)]">No team found for “{teamAbbr}”.</p>}
      {team && <TeamHeaderBar team={team} standing={standing} />}
      {team && (
        <PositionGroupToggle
          options={TEAM_TABS}
          active={tab}
          onChange={setTab}
          labelFor={(value) => TAB_LABELS[value]}
          aria-label="Team view"
        />
      )}
      {team && tab === "overview" && (
        <>
          <Panel title="Game Log">
            {games.loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
            {games.error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load game log: {games.error}</p>}
            {log && log.rows.length === 0 && (
              <p className="p-4 text-sm text-[var(--text-secondary)]">No games played yet this season.</p>
            )}
            {log && log.rows.length > 0 && (
              <div className="overflow-x-auto">
                <GameLogTable columns={log.columns} rows={log.rows} totals={log.totals} />
              </div>
            )}
          </Panel>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TeamRadarChart teamAbbr={team.team_abbr} teamColor={team.team_color} />
            <TeamScoringComposition teamAbbr={team.team_abbr} />
          </div>
          <TeamLeagueComparisonBeeswarm teamAbbr={team.team_abbr} teamColor={team.team_color} />
          <TeamTendenciesPanel teamAbbr={team.team_abbr} />
        </>
      )}
      {team && tab === "playmaking" && <TeamPlaymakingPanel teamAbbr={team.team_abbr} />}
      {team && tab === "depth-chart" && <TeamDepthChartPanel teamAbbr={team.team_abbr} />}
    </div>
  )
}

export default TeamPage
