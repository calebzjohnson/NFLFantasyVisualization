// TeamsPage.tsx
// Teams route: team search, team leaders, a pick-your-axes team scatter, and trending
// teams - all built from one /teams/weekly fetch. Clicking a team anywhere
// opens its team page.
import { useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import MetricScatter from "../components/MetricScatter"
import SearchBar from "../components/SearchBar"
import TeamLeadersPanel from "../components/TeamLeadersPanel"
import { TeamLogoBadge, TeamLogoMarker } from "../components/TeamLogo"
import TrendChart from "../components/TrendChart"
import type { PlayerMetric } from "../data/playerMetrics"
import { TEAM_METRICS, teamSeasonRows, trendingTeams, type TeamGameRow } from "../data/teamMetrics"
import { teamPath, type TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"

function TeamsPage() {
  const navigate = useNavigate()
  const games = useFetch<TeamGameRow[]>("/teams/weekly")
  const teams = useFetch<TeamInfo[]>("/teams")
  const loading = games.loading || teams.loading
  const error = games.error ?? teams.error

  const seasonRows = useMemo(
    () => (games.data && teams.data ? teamSeasonRows(games.data, teams.data) : null),
    [games.data, teams.data],
  )

  const trends = useCallback(
    (metric: PlayerMetric) =>
      games.data && teams.data ? trendingTeams(games.data, metric, teams.data) : { up: [], down: [] },
    [games.data, teams.data],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-wide text-[var(--text-primary)] uppercase">Teams</h1>
        <div className="w-56">
          <SearchBar placeholder="Search teams..." scope="teams" />
        </div>
      </div>
      <TeamLeadersPanel rows={seasonRows} loading={loading} error={error} />
      <MetricScatter
        title="Compare Teams"
        metrics={TEAM_METRICS}
        initialX="points"
        initialY="points_allowed"
        rows={seasonRows}
        loading={loading}
        error={error}
        noun="teams"
        emptyText="No games played yet."
        Dot={(props) => <TeamLogoMarker {...props} onSelect={() => props.payload && navigate(teamPath(props.payload.team))} />}
        renderTooltipHeader={(row) => (
          <div className="flex items-center gap-2">
            <TeamLogoBadge logo={row.logo} size="h-7 w-7" />
            <div className="text-sm text-[var(--text-primary)]">{row.name}</div>
          </div>
        )}
        caption={
          <>
            Each logo is a team, positioned by its per-game average in the two stats you pick above.
            The lighter lines mark the median team in each stat, splitting the chart into four
            quadrants. For stats a defense allows, lower is better.
          </>
        }
      />
      <TrendChart
        title="Trending Teams"
        metrics={TEAM_METRICS}
        plural="teams"
        singular="team"
        loading={loading}
        error={error}
        trends={trends}
        onSelect={(line) => navigate(teamPath(line.id))}
      />
    </div>
  )
}

export default TeamsPage
