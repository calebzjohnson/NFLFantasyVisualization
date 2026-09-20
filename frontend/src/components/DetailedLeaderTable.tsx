// DetailedLeaderTable.tsx
// Ranked player table with per-category stat columns.
import type { DetailedLeaderRow, LeaderColumn } from "../data/leaderStatsTypes"

interface DetailedLeaderTableProps {
  columns: LeaderColumn[]
  rows: DetailedLeaderRow[]
}

function DetailedLeaderTable({ columns, rows }: DetailedLeaderTableProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[var(--text-muted)]">
          <th className="w-8 px-4 py-2 font-normal">#</th>
          <th className="px-2 py-2 font-normal">Player</th>
          {columns.map((column, index) => (
            <th
              key={column.key}
              className={`py-2 text-right font-normal ${index === columns.length - 1 ? "px-4" : "px-2"}`}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.rank} className="border-t border-[var(--border)]">
            <td className="px-4 py-2 text-[var(--text-muted)]">{row.rank}</td>
            <td className="px-2 py-2">
              <div className="font-medium text-[var(--text-primary)]">{row.player}</div>
              <div className="text-xs text-[var(--text-secondary)]">{row.team}</div>
            </td>
            {columns.map((column, index) => (
              <td
                key={column.key}
                className={`py-2 text-right tabular-nums text-[var(--text-primary)] ${index === columns.length - 1 ? "px-4" : "px-2"}`}
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
