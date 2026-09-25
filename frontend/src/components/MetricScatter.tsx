// MetricScatter.tsx
// Pick-your-axes scatterplot shared by Compare Players and Compare Teams: two
// metric pickers, median quadrant lines, and a tooltip. The caller supplies
// the rows, the marker, and the tooltip header. Built on the Evil Charts
// chart/tooltip base.
import { type ReactElement, type ReactNode, useMemo, useState } from "react"
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis } from "recharts"
import { metricMedian, type PlayerMetric, type StatFields } from "../data/playerMetrics"
import AxisSelect from "./AxisSelect"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import { ChartTooltip, ChartTooltipContent } from "./evilcharts/ui/recharts-tooltip"
import Panel from "./Panel"

const chartConfig = {
  point: { label: "Point" },
} satisfies ChartConfig

function formatValue(value: number, unit?: string): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10
  return `${rounded.toLocaleString()}${unit ?? ""}`
}

// "+120" / "−45" / "0" - for the tooltip's "how far from the median" note, in
// the metric's own unit rather than a statistical score.
function formatOffset(value: number, unit?: string): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10
  if (rounded === 0) return `0${unit ?? ""}`
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toLocaleString()}${unit ?? ""}`
}

// Pad the domain so no marker sits flush against the plot edge. Percentage
// scaled by the data's own range rather than a fixed step, since raw units
// vary wildly - a few hundred passing yards vs. a handful of TDs vs. a
// percentage point.
function valueDomain(values: number[]): [number, number] {
  if (values.length === 0) return [-1, 1]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.08, 1)
  return [min - pad, max + pad]
}

function TooltipRow({
  name,
  value,
  unit,
  offset,
}: {
  name: string
  value: number
  unit?: string
  offset: number
}) {
  return (
    <div className="flex w-full items-baseline justify-between gap-4">
      <span className="text-[var(--text-secondary)]">{name}</span>
      <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
        {formatValue(value, unit)}{" "}
        <span className="text-[10px] text-[var(--text-muted)]">
          ({formatOffset(offset, unit)} vs. median)
        </span>
      </span>
    </div>
  )
}

interface MetricScatterProps<Row extends StatFields> {
  title: string
  metrics: PlayerMetric[]
  // Metric keys to start on; default to the first two metrics.
  initialX?: string
  initialY?: string
  rows: Row[] | null
  loading: boolean
  error: string | null
  // Plural noun for the error message, e.g. "players".
  noun: string
  emptyText: string
  caption: ReactNode
  Dot: (props: { cx?: number; cy?: number; payload?: Row }) => ReactElement | null
  renderTooltipHeader: (row: Row) => ReactNode
}

function MetricScatter<Row extends StatFields>({
  title,
  metrics,
  initialX = metrics[0].key,
  initialY = metrics[1]?.key ?? metrics[0].key,
  rows,
  loading,
  error,
  noun,
  emptyText,
  caption,
  Dot,
  renderTooltipHeader,
}: MetricScatterProps<Row>) {
  const [xKey, setXKey] = useState(initialX)
  const [yKey, setYKey] = useState(initialY)

  const xMetric = metrics.find((metric) => metric.key === xKey) ?? metrics[0]
  const yMetric = metrics.find((metric) => metric.key === yKey) ?? metrics[0]

  // The quadrant lines sit at the median, but each axis plots the real stat -
  // ticks, dot positions, and the tooltip's headline number are all in the
  // metric's own unit; only the tooltip's small "vs. median" note is an offset.
  const xMedian = useMemo(() => (rows ? metricMedian(rows, xMetric) : 0), [rows, xMetric])
  const yMedian = useMemo(() => (rows ? metricMedian(rows, yMetric) : 0), [rows, yMetric])

  const points = useMemo(
    () => rows?.map((row) => ({ ...row, x: xMetric.value(row), y: yMetric.value(row) })) ?? null,
    [rows, xMetric, yMetric],
  )

  const xDomain = useMemo(() => valueDomain(points?.map((p) => p.x) ?? []), [points])
  const yDomain = useMemo(() => valueDomain(points?.map((p) => p.y) ?? []), [points])

  const optionByLabel = new Map(metrics.map((metric) => [metric.label, metric]))

  return (
    <Panel title={title}>
      <div className="flex flex-nowrap items-center gap-3 overflow-x-auto border-b border-[var(--border)] px-4 py-3">
        <AxisSelect
          label="X axis"
          value={xMetric.label}
          options={metrics.map((metric) => metric.label)}
          onChange={(label) => setXKey(optionByLabel.get(label)?.key ?? metrics[0].key)}
        />
        <AxisSelect
          label="Y axis"
          value={yMetric.label}
          options={metrics.map((metric) => metric.label)}
          onChange={(label) => setYKey(optionByLabel.get(label)?.key ?? metrics[0].key)}
        />
      </div>
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && (
        <p className="p-4 text-sm text-[var(--negative)]">
          Couldn't load {noun}: {error}
        </p>
      )}
      {points && points.length === 0 && <p className="p-4 text-sm text-[var(--text-secondary)]">{emptyText}</p>}
      {points && points.length > 0 && (
        <div className="p-3">
          <ChartContainer config={chartConfig} className="aspect-[3/2]">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} />
              <XAxis
                type="number"
                dataKey="x"
                name={xMetric.label}
                domain={xDomain}
                tickFormatter={(value) => formatValue(Number(value), xMetric.unit)}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                label={{
                  value: xMetric.label,
                  position: "insideBottom",
                  offset: -14,
                  fill: "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={yMetric.label}
                domain={yDomain}
                tickFormatter={(value) => formatValue(Number(value), yMetric.unit)}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                width={54}
                label={{
                  value: yMetric.label,
                  angle: -90,
                  position: "insideLeft",
                  offset: 4,
                  style: { textAnchor: "middle" },
                  fill: "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
              <ReferenceLine x={xMedian} stroke="var(--text-muted)" strokeOpacity={0.5} />
              <ReferenceLine y={yMedian} stroke="var(--text-muted)" strokeOpacity={0.5} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    variant="frosted-glass"
                    hideIndicator
                    labelFormatter={(_, items) => {
                      const row = items[0]?.payload as Row | undefined
                      return row ? renderTooltipHeader(row) : null
                    }}
                    formatter={(value, name) => {
                      const metric: PlayerMetric | undefined =
                        name === xMetric.label ? xMetric : name === yMetric.label ? yMetric : undefined
                      const median = name === xMetric.label ? xMedian : yMedian
                      return (
                        <TooltipRow
                          name={String(name)}
                          value={Number(value)}
                          unit={metric?.unit}
                          offset={Number(value) - median}
                        />
                      )
                    }}
                  />
                }
              />
              <Scatter data={points} shape={Dot} isAnimationActive={false} />
            </ScatterChart>
          </ChartContainer>
          <p className="pt-2 text-xs text-[var(--text-muted)]">{caption}</p>
        </div>
      )}
    </Panel>
  )
}

export default MetricScatter
