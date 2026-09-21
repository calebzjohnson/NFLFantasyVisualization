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
        <div className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-0)] p-1">
          {LEADER_CATEGORIES.map((category) => (
            <button
              key={category.key}
              type="button"
              onClick={() => setActiveKey(category.key)}
              aria-pressed={category.key === activeKey}
              className={`rounded px-3 py-0.5 font-display text-base tracking-wider uppercase transition-colors ${
                category.key === activeKey
                  ? "bg-[var(--accent)] font-bold text-[var(--surface-0)]"
                  : "font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      }
    >
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
