// TeamLeadersPanel.tsx
// Team Leaders: top 5 teams in per-game offense or defense stats, with an
// Offense/Defense toggle in the header. Any column re-sorts; stats where
// lower is better (points allowed, turnovers) sort best-first on first click.
import { useState } from "react"
import type { LeaderRow } from "../data/leaderStatsTypes"
import { TEAM_METRICS, TEAM_SIDES, type TeamSeasonRow, type TeamSide } from "../data/teamMetrics"
import DetailedLeaderTable from "./DetailedLeaderTable"
import Panel from "./Panel"
import PositionGroupToggle from "./PositionGroupToggle"
import { TeamLogoBadge } from "./TeamLogo"

const LEADER_ROWS_SHOWN = 5

type TeamLeaderRow = LeaderRow & { team: string; name: string; logo: string }

function metricsFor(side: TeamSide) {
  return TEAM_METRICS.filter((metric) => metric.side === side)
}

function TeamCell({ row }: { row: TeamLeaderRow }) {
  return (
    <div className="flex items-center gap-3">
      <TeamLogoBadge logo={row.logo} size="h-8 w-8" />
      <div>
        <div className="font-medium text-[var(--text-primary)]">{row.name}</div>
        <div className="text-xs text-[var(--text-secondary)]">{row.team}</div>
      </div>
    </div>
  )
}

function TeamLeadersPanel({
  rows,
  loading,
  error,
}: {
  rows: TeamSeasonRow[] | null
  loading: boolean
  error: string | null
}) {
  const [side, setSide] = useState<TeamSide>(TEAM_SIDES[0])
  const metrics = metricsFor(side)
  const [sortKey, setSortKey] = useState(metrics[0].key)
  const [sortDesc, setSortDesc] = useState(!metrics[0].lowerIsBetter)

  function sortBy(key: string) {
    const metric = TEAM_METRICS.find((m) => m.key === key)!
    setSortKey(key)
    setSortDesc(!metric.lowerIsBetter)
  }

  function handleSideChange(next: TeamSide) {
    setSide(next)
    sortBy(metricsFor(next)[0].key)
  }

  function handleSort(key: string) {
    if (key === sortKey) setSortDesc((desc) => !desc)
    else sortBy(key)
  }

  const leaders: TeamLeaderRow[] | null =
    rows
      ?.map((row) => ({
        team: row.team,
        name: row.name,
        logo: row.logo,
        rank: 0,
        stats: Object.fromEntries(metrics.map((metric) => [metric.key, metric.value(row)])),
      }))
      .sort((a, b) => (sortDesc ? b.stats[sortKey] - a.stats[sortKey] : a.stats[sortKey] - b.stats[sortKey]))
      .slice(0, LEADER_ROWS_SHOWN)
      .map((row, index) => ({ ...row, rank: index + 1 })) ?? null

  return (
    <Panel
      title="Team Leaders"
      actions={
        <PositionGroupToggle options={TEAM_SIDES} active={side} onChange={handleSideChange} aria-label="Side of the ball" />
      }
    >
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load team leaders: {error}</p>}
      {leaders && (
        <div className="overflow-x-auto">
          <DetailedLeaderTable
            entityLabel="Team"
            renderEntity={(row) => <TeamCell row={row} />}
            columns={metrics.map((metric) => ({ key: metric.key, label: metric.short }))}
            rows={leaders}
            sortKey={sortKey}
            sortDesc={sortDesc}
            onSort={handleSort}
          />
        </div>
      )}
      <p className="px-4 pb-3 text-xs text-[var(--text-muted)]">Per-game averages this regular season.</p>
    </Panel>
  )
}

export default TeamLeadersPanel
