// StatLeadersPanel.tsx
// Stat leaders table for one position group; fetches /players for it.
// Which position is active is owned by the caller (e.g. a page-level toggle) -
// pass an optional `actions` (e.g. <PositionGroupToggle />) to render a
// switcher in the panel header, for a caller that isn't controlling position
// from elsewhere on the page.
import type { ReactNode } from "react"
import { LEADER_CATEGORIES, type PositionGroup, type RawPlayerRow } from "../data/leaderCategories"
import type { DetailedLeaderRow } from "../data/leaderStatsTypes"
import { useFetch } from "../lib/useFetch"
import DetailedLeaderTable from "./DetailedLeaderTable"
import Panel from "./Panel"

function StatLeadersPanel({
  position,
  actions,
}: {
  position: PositionGroup
  actions?: ReactNode
}) {
  const active = LEADER_CATEGORIES.find((category) => category.position === position)!
  const { data, error, loading } = useFetch<RawPlayerRow[]>(active.path)

  const rows: DetailedLeaderRow[] | null =
    data?.map((row, index) => ({
      rank: index + 1,
      player: String(row.player_display_name),
      team: String(row.recent_team),
      stats: active.toStats(row),
    })) ?? null

  return (
    <Panel title={`${active.label} Leaders`} actions={actions}>
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load leaders: {error}</p>}
      {rows && (
        <div className="overflow-x-auto">
          <DetailedLeaderTable columns={active.columns} rows={rows} />
        </div>
      )}
    </Panel>
  )
}

export default StatLeadersPanel
