// TeamsPage.tsx
// Teams route: team leaders, a pick-your-axes team scatter, and trending
// teams - all built from one /teams/weekly fetch.
import { useCallback, useMemo } from "react"
import MetricScatter from "../components/MetricScatter"
import TeamLeadersPanel from "../components/TeamLeadersPanel"
import { TeamLogoBadge, TeamLogoMarker } from "../components/TeamLogo"
import TrendChart from "../components/TrendChart"
import type { PlayerMetric } from "../data/playerMetrics"
import { TEAM_METRICS, teamSeasonRows, trendingTeams, type TeamGameRow } from "../data/teamMetrics"
import type { TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"

function TeamsPage() {
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
      <h1 className="font-display text-3xl font-bold tracking-wide text-[var(--text-primary)] uppercase">Teams</h1>
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
        Dot={TeamLogoMarker}
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
      />
    </div>
  )
}

export default TeamsPage
