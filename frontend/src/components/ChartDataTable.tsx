// ChartDataTable.tsx
// "Show data as table" toggle under a chart: the chart's numbers as a real table, for screen readers and anyone who wants exact values.
export type ChartCell = string | number | null

interface ChartDataTableProps {
  caption: string
  columns: string[]
  // The first cell of each row names it (a player, team, or stat).
  rows: ChartCell[][]
}

function ChartDataTable({ caption, columns, rows }: ChartDataTableProps) {
  return (
    <details className="px-3 pb-1 pt-2 text-xs text-[var(--text-muted)]">
      <summary className="cursor-pointer text-[var(--text-secondary)]">Show data as table</summary>
      {/* Focusable so keyboard users can scroll a long or wide table. */}
      <div tabIndex={0} role="region" aria-label={caption} className="mt-2 max-h-80 overflow-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-[var(--surface-1)]">
            <tr>
              {columns.map((column, i) => (
                <th key={`${column}-${i}`} scope="col" className="border-b border-[var(--border)] px-2 py-1 font-medium text-[var(--text-secondary)]">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, ...cells], i) => (
              <tr key={`${name}-${i}`}>
                <th scope="row" className="px-2 py-1 font-medium whitespace-nowrap text-[var(--text-secondary)]">
                  {name ?? "—"}
                </th>
                {cells.map((cell, j) => (
                  <td key={j} className="px-2 py-1 font-mono tabular-nums whitespace-nowrap text-[var(--text-primary)]">
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export default ChartDataTable
