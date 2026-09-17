import { useState } from "react"
import { DETAILED_LEADER_CATEGORIES } from "../data/dummyDetailedLeaders"
import DetailedLeaderTable from "./DetailedLeaderTable"
import Panel from "./Panel"

function StatLeadersPanel() {
  const [activeKey, setActiveKey] = useState(DETAILED_LEADER_CATEGORIES[0].key)
  const active = DETAILED_LEADER_CATEGORIES.find((category) => category.key === activeKey)!

  return (
    <Panel
      title="Stat Leaders"
      actions={
        <div className="flex gap-1">
          {DETAILED_LEADER_CATEGORIES.map((category) => (
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
      <DetailedLeaderTable columns={active.columns} rows={active.rows} />
    </Panel>
  )
}

export default StatLeadersPanel
