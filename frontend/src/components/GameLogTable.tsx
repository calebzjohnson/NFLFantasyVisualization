// GameLogTable.tsx
// ESPN-style per-game stat table: one row per week, oldest first.
import type { LeaderColumn } from "../data/leaderStatsTypes"

const TONE = {
  positive: "text-[var(--positive)]",
  negative: "text-[var(--negative)]",
}

export interface GameLogRow {
  week: number
  opponent: string
  stats: Record<string, number>
}

interface GameLogTableProps {
  columns: LeaderColumn[]
  rows: GameLogRow[]
  totals: Record<string, number>
}

function GameLogTable({ columns, rows, totals }: GameLogTableProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs tracking-wider text-[var(--text-muted)] uppercase">
          <th className="w-10 px-4 py-2 font-medium">WK</th>
          <th className="px-2 py-2 font-medium">OPP</th>
          {columns.map((column, index) => (
            <th
              key={column.key}
              className={`py-2 text-right font-medium ${index === columns.length - 1 ? "px-4" : "px-2"}`}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.week} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]">
            <td className="px-4 py-2 font-display text-[var(--text-muted)]">{row.week}</td>
            <td className="px-2 py-2 text-[var(--text-primary)]">{row.opponent}</td>
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
      <tfoot>
        <tr className="border-t-2 border-[var(--border)] font-medium">
          <td className="px-4 py-2 text-[var(--text-muted)]" colSpan={2}>
            Total
          </td>
          {columns.map((column, index) => (
            <td
              key={column.key}
              className={`py-2 text-right tabular-nums ${index === columns.length - 1 ? "px-4" : "px-2"} text-[var(--text-primary)]`}
            >
              {totals[column.key]}
            </td>
          ))}
        </tr>
      </tfoot>
    </table>
  )
}

export default GameLogTable
