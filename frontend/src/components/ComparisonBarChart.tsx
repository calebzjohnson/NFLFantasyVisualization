// ComparisonBarChart.tsx
// Create page bar chart: one small set of bars per picked stat, a bar per picked player or team, each stat on its own scale.
// One shared axis would flatten 30 TDs next to 4,000 passing yards. Plain HTML
// bars with each value written beside its bar, so there's nothing to hover
// and nothing hidden on a phone; a stat with negative values (EPA) gets a zero line,
// and picks under a per-play stat's minimum sample are named beneath it.
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import type { BarRow } from "../data/chartBuilder"
import { formatValue, type PlayerMetric } from "../data/playerMetrics"
import Panel from "./Panel"

function StatBars({ metric, rows }: { metric: PlayerMetric; rows: BarRow[] }) {
  const values = rows.flatMap((row) => row.values[metric.key] ?? [])
  const low = Math.min(0, ...values)
  const high = Math.max(0, ...values)
  const span = high - low || 1
  const percent = (value: number) => `${(value / span) * 100}%`
  const small = rows.filter((row) => row.smallSamples[metric.key] !== undefined)

  return (
    <section aria-label={metric.label}>
      <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{metric.label}</h3>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const value = row.values[metric.key]
          return (
            <li key={row.id} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-xs">
              <Link
                to={row.href}
                title={row.name}
                className="truncate text-[var(--text-secondary)] hover:text-[var(--accent)] hover:underline"
              >
                {row.name}
              </Link>
              <div className="relative h-4 rounded-sm bg-[var(--surface-2)]" aria-hidden="true">
                {value !== null && (
                  <div
                    className="absolute inset-y-0 rounded-sm"
                    style={{
                      left: percent(Math.min(value, 0) - low),
                      width: percent(Math.abs(value)),
                      backgroundColor: row.color,
                    }}
                  />
                )}
                {low < 0 && (
                  <div className="absolute inset-y-0 w-px bg-[var(--text-muted)]" style={{ left: percent(-low) }} />
                )}
              </div>
              <span className="text-right font-mono tabular-nums text-[var(--text-primary)]">
                {value === null ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">no stats</span>
                  </>
                ) : (
                  formatValue(value, metric)
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {small.length > 0 && metric.minSample && (
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">
          Small sample:{" "}
          {small.map((row) => `${row.name} (${row.smallSamples[metric.key]} ${metric.minSample!.noun})`).join(", ")}.
          Under {metric.minSample.min} {metric.minSample.noun}, this swings a lot on a handful of plays.
        </p>
      )}
    </section>
  )
}

function ComparisonBarChart({
  title,
  rows,
  metrics,
  footer,
}: {
  title: string
  rows: BarRow[]
  metrics: PlayerMetric[]
  // Under the bars, e.g. a stat glossary.
  footer?: ReactNode
}) {
  return (
    <Panel title={title}>
      <div className="grid gap-6 p-4 sm:grid-cols-2">
        {metrics.map((metric) => (
          <StatBars key={metric.key} metric={metric} rows={rows} />
        ))}
      </div>
      {footer && <div className="px-1 pb-3">{footer}</div>}
    </Panel>
  )
}

export default ComparisonBarChart
