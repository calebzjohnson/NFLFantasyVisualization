// StatLeadersPanel.tsx
// Stat leaders table for one position group; fetches /players for it.
// Which position is active is owned by the caller (e.g. a page-level toggle) -
// pass an optional `actions` (e.g. <PositionGroupToggle />) to render a
// switcher in the panel header, for a caller that isn't controlling position
// from elsewhere on the page.
import { type ReactNode, useState } from "react"
import { LEADER_CATEGORIES, type PositionGroup, type RawPlayerRow } from "../data/leaderCategories"
import type { DetailedLeaderRow } from "../data/leaderStatsTypes"
import { useFetch } from "../lib/useFetch"
import DetailedLeaderTable from "./DetailedLeaderTable"
import Panel from "./Panel"

const LEADER_ROWS_SHOWN = 5

function StatLeadersPanel({
  position,
  actions,
}: {
  position: PositionGroup
  actions?: ReactNode
}) {
  const active = LEADER_CATEGORIES.find((category) => category.position === position)!
  const { data, error, loading } = useFetch<RawPlayerRow[]>(active.path)

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
