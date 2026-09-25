// StatLeadersPanel.tsx
// Stat leaders table for one position group; fetches /players for it.
// Which position is active is owned by the caller (e.g. a page-level toggle) -
// pass an optional `actions` (e.g. <PositionGroupToggle />) to render a
// switcher in the panel header, for a caller that isn't controlling position
// from elsewhere on the page.
import { type ReactNode, useState } from "react"
import { Link } from "react-router-dom"
import { LEADER_CATEGORIES, type PositionGroup, type RawPlayerRow } from "../data/leaderCategories"
import type { DetailedLeaderRow } from "../data/leaderStatsTypes"
import type { TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"
import DetailedLeaderTable from "./DetailedLeaderTable"
import Panel from "./Panel"
import PlayerAvatar from "./PlayerAvatar"
import TeamLink from "./TeamLink"

const LEADER_ROWS_SHOWN = 5

function PlayerCell({ row }: { row: DetailedLeaderRow }) {
  return (
    <div className="flex items-center gap-3">
      <PlayerAvatar name={row.player} headshot={row.headshot} color={row.teamColor} size="h-8 w-8" />
      <div>
        <Link
          to={`/players/${row.playerId}`}
          state={{ playerName: row.player }}
          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
        >
          {row.player}
        </Link>
        <TeamLink team={row.team} className="block text-xs text-[var(--text-secondary)]">
          {row.team}
        </TeamLink>
      </div>
    </div>
  )
}

function StatLeadersPanel({
  position,
  actions,
}: {
  position: PositionGroup
  actions?: ReactNode
}) {
  const active = LEADER_CATEGORIES.find((category) => category.position === position)!
  const { data, error, loading } = useFetch<RawPlayerRow[]>(active.path)
  const teams = useFetch<TeamInfo[]>("/teams")
  const colorByTeam = new Map(teams.data?.map((team) => [team.team_abbr, team.team_color]))

  const [sortedPosition, setSortedPosition] = useState(position)
  const [sortKey, setSortKey] = useState(active.defaultSortKey)
  const [sortDesc, setSortDesc] = useState(true)

  // Position changed out from under us - go back to that category's own default column.
  // (Adjusting state during render, not an effect, per https://react.dev/learn/you-might-not-need-an-effect)
  if (position !== sortedPosition) {
    setSortedPosition(position)
    setSortKey(active.defaultSortKey)
    setSortDesc(true)
  }

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDesc((desc) => !desc)
    } else {
      setSortKey(key)
      setSortDesc(true)
    }
  }

  const rows: DetailedLeaderRow[] | null =
    data
      ?.map((row) => ({
        playerId: String(row.player_id),
        player: String(row.player_display_name),
        team: String(row.recent_team),
        headshot: row.headshot_url,
        teamColor: colorByTeam.get(String(row.recent_team)) ?? "var(--accent)",
        stats: active.toStats(row),
      }))
      .sort((a, b) => (sortDesc ? b.stats[sortKey] - a.stats[sortKey] : a.stats[sortKey] - b.stats[sortKey]))
      .slice(0, LEADER_ROWS_SHOWN)
      .map((row, index) => ({ ...row, rank: index + 1 })) ?? null

  return (
    <Panel title={`${active.label} Leaders`} actions={actions}>
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load leaders: {error}</p>}
      {rows && (
        <div className="overflow-x-auto">
          <DetailedLeaderTable
            entityLabel="Player"
            renderEntity={(row) => <PlayerCell row={row} />}
            columns={active.columns}
            rows={rows}
            sortKey={sortKey}
            sortDesc={sortDesc}
            onSort={handleSort}
          />
        </div>
      )}
    </Panel>
  )
}

export default StatLeadersPanel
