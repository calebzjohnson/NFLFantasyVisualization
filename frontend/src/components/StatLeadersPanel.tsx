// StatLeadersPanel.tsx
// Passing/Receiving/Rushing leaders panel; fetches /players for the active tab.
import { useState } from "react"
import { LEADER_CATEGORIES, type RawPlayerRow } from "../data/leaderCategories"
import type { DetailedLeaderRow } from "../data/leaderStatsTypes"
import { useFetch } from "../lib/useFetch"
import DetailedLeaderTable from "./DetailedLeaderTable"
import Panel from "./Panel"

function StatLeadersPanel() {
  const [activeKey, setActiveKey] = useState(LEADER_CATEGORIES[0].key)
  const active = LEADER_CATEGORIES.find((category) => category.key === activeKey)!
  const { data, error, loading } = useFetch<RawPlayerRow[]>(active.path)

  const rows: DetailedLeaderRow[] | null =
    data?.map((row, index) => ({
      rank: index + 1,
      player: String(row.player_display_name),
      team: String(row.recent_team),
      stats: active.toStats(row),
    })) ?? null

  return (
    <Panel
      title="Stat Leaders"
      actions={
        <div className="flex gap-1">
          {LEADER_CATEGORIES.map((category) => (
            <button
              key={category.key}
              type="button"
              onClick={() => setActiveKey(category.key)}
              aria-pressed={category.key === activeKey}
              className={
                category.key === activeKey
                  ? "rounded bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white"
                  : "rounded px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }
            >
              {category.label}
            </button>
          ))}
        </div>
      }
    >
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-red-600">Couldn't load leaders: {error}</p>}
      {rows && <DetailedLeaderTable columns={active.columns} rows={rows} />}
    </Panel>
  )
}

export default StatLeadersPanel
