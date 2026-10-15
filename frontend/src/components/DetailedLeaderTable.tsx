// DetailedLeaderTable.tsx
// Ranked, sortable stat table; the caller renders each row's name cell (player, team, ...).
import type { CSSProperties, ReactNode } from "react"
import type { LeaderColumn, LeaderRow } from "../data/leaderStatsTypes"

// Rank and name stay pinned while the stats scroll sideways. Fixed rank width
// so the name column knows its left offset; opaque backgrounds hide the stats
// passing underneath, and the inset shadow draws the pinned edge (a border would
// scroll away under border-collapse). The name overlaps the rank by 1px so
// subpixel rounding never leaves a seam for scrolled text to show through.
// On phones the rank column shrinks to fit its widest rank (--rank-w) and the
// name drops its left padding, so rank-to-headshot matches headshot-to-name.
const PINNED = "sticky z-[1] bg-[var(--surface-1)] group-hover:bg-[var(--surface-2)]"
const PINNED_RANK = `${PINNED} left-0 w-12 min-w-12 px-3 max-sm:w-(--rank-w) max-sm:min-w-(--rank-w)`
const PINNED_NAME = `${PINNED} left-[calc(3rem-1px)] px-2 max-sm:left-[calc(var(--rank-w)-1px)] max-sm:pl-0 shadow-[inset_-1px_0_0_var(--border)]`
// Widest rank digit in the display font at text-lg (measured ~8.7px), plus px-3 on both sides.
const RANK_DIGIT_PX = 9
const RANK_PADDING_PX = 24

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
  const rankDigits = String(Math.max(1, ...rows.map((row) => row.rank))).length
  const rankWidth = { "--rank-w": `${RANK_PADDING_PX + rankDigits * RANK_DIGIT_PX}px` } as CSSProperties
  return (
    <table className="w-full text-sm" style={rankWidth}>
      {/* Sticky so the columns stay readable when the expanded view scrolls a
          full position group. */}
      <thead className="sticky top-0 z-10 bg-[var(--surface-1)]">
        <tr className="text-left text-xs tracking-wider text-[var(--text-muted)] uppercase">
          <th className={`${PINNED_RANK} py-2 font-medium`}>#</th>
          <th className={`${PINNED_NAME} py-2 font-medium`}>{entityLabel}</th>
          {columns.map((column, index) => (
            <th
              key={column.key}
              className={`py-1 text-right font-medium ${index === columns.length - 1 ? "px-4" : "px-2"}`}
            >
              {/* The button carries the cell's vertical padding, so its tap
                  area is 24px tall while the row stays the same height. */}
              <button
                type="button"
                onClick={() => onSort(column.key)}
                className="inline-flex items-center gap-0.5 py-1 hover:text-[var(--text-primary)]"
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
          <tr key={row.rank} className="group border-t border-[var(--border)] hover:bg-[var(--surface-2)]">
            <td
              className={`${PINNED_RANK} py-2 font-display text-lg ${
                row.rank === 1 ? "font-bold text-[var(--accent)]" : "text-[var(--text-muted)]"
              }`}
            >
              {row.rank}
            </td>
            <td className={`${PINNED_NAME} py-2`}>{renderEntity(row)}</td>
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
