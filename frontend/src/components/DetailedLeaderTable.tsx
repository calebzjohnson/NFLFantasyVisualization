// DetailedLeaderTable.tsx
// Ranked, sortable stat table; the caller renders each row's name cell (player, team, ...).
import type { ReactNode } from "react"
import type { LeaderColumn, LeaderRow } from "../data/leaderStatsTypes"

const TONE = {
  positive: "text-[var(--positive)]",
  negative: "text-[var(--negative)]",
}

interface DetailedLeaderTableProps<Row extends LeaderRow> {
  entityLabel: string
  renderEntity: (row: Row) => ReactNode
  columns: LeaderColumn[]
  rows: Row[]
  sortKey: string
  sortDesc: boolean
  onSort: (key: string) => void
}

function DetailedLeaderTable<Row extends LeaderRow>({
  entityLabel,
  renderEntity,
  columns,
  rows,
  sortKey,
  sortDesc,
  onSort,
}: DetailedLeaderTableProps<Row>) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs tracking-wider text-[var(--text-muted)] uppercase">
          <th className="w-8 px-4 py-2 font-medium">#</th>
          <th className="px-2 py-2 font-medium">{entityLabel}</th>
          {columns.map((column, index) => (
            <th
              key={column.key}
              className={`py-2 text-right font-medium ${index === columns.length - 1 ? "px-4" : "px-2"}`}
            >
              <button
                type="button"
                onClick={() => onSort(column.key)}
                className="inline-flex items-center gap-0.5 hover:text-[var(--text-primary)]"
              >
                {column.label}
                <span className={sortKey === column.key ? "text-[var(--accent)]" : "text-[var(--text-muted)]/50"}>
                  {sortKey === column.key ? (sortDesc ? "▼" : "▲") : "▼"}
                </span>
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.rank} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]">
            <td
              className={`px-4 py-2 font-display text-lg ${
                row.rank === 1 ? "font-bold text-[var(--accent)]" : "text-[var(--text-muted)]"
              }`}
            >
              {row.rank}
            </td>
            <td className="px-2 py-2">{renderEntity(row)}</td>
            {columns.map((column, index) => (
              <td
                key={column.key}
                className={`py-2 text-right tabular-nums ${index === columns.length - 1 ? "px-4" : "px-2"} ${
                  column.tone ? TONE[column.tone] : "text-[var(--text-primary)]"
                }`}
              >
                {row.stats[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default DetailedLeaderTable
