// chartSummaries.ts
// Plain-language summaries and data-table rows for the radar and beeswarm charts' accessible alternatives.
import type { ChartCell } from "../components/ChartDataTable"
import { ordinal } from "../data/efficiency"

export interface RankedAxis {
  label: string
  value: number | null
  percentile: number | null
}

export function percentileText(percentile: number | null): string | null {
  return percentile === null ? null : ordinal(Math.round(percentile))
}

// "Patrick Mahomes compared with every other QB ... Strongest: EPA/Dropback (92nd). Weakest: ..."
export function radarSummary(subject: string, peers: string, axes: RankedAxis[]): string {
  const base = `${subject} compared with ${peers} this season on ${axes.length} stats, as percentile ranks where 50 is league average.`
  const ranked = axes.filter((axis) => axis.percentile !== null)
  if (ranked.length === 0) return base
  const byPercentile = [...ranked].sort((a, b) => b.percentile! - a.percentile!)
  const best = byPercentile[0]
  const worst = byPercentile[byPercentile.length - 1]
  return `${base} Strongest: ${best.label} (${percentileText(best.percentile)}). Weakest: ${worst.label} (${percentileText(worst.percentile)}).`
}

export function radarRows(axes: RankedAxis[]): ChartCell[][] {
  return axes.map((axis) => [axis.label, axis.value, percentileText(axis.percentile)])
}

// One beeswarm cell: the raw stat with its percentile, e.g. "0.21 (82nd)".
export function swarmCell(axis: { value: number | null; percentile: number | null }): ChartCell {
  if (axis.value === null) return null
  const percentile = percentileText(axis.percentile)
  return percentile ? `${axis.value} (${percentile})` : String(axis.value)
}
