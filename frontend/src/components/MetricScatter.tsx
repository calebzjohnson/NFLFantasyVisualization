// MetricScatter.tsx
// Pick-your-axes scatterplot shared by Compare Players and Compare Teams: two
// metric pickers, median quadrant lines, and a tooltip. The caller supplies
// the rows, the marker, and the tooltip header. Built on the Evil Charts
// chart/tooltip base. Clicking a mark (or picking it in the search box)
// highlights it: drawn on top, ringed and labeled, with everything else faded.
// Clicking the highlighted mark again opens its page. On a touchscreen the
// tooltip is replaced by a details box below the chart for the highlighted mark.
import { type ReactElement, type ReactNode, useMemo, useState } from "react"
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis } from "recharts"
import { metricMedian, type PlayerMetric, type StatFields } from "../data/playerMetrics"
import { TOUCH_QUERY, useMediaQuery } from "../lib/useMediaQuery"
import AxisSelect from "./AxisSelect"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import { ChartTooltip, ChartTooltipContent } from "./evilcharts/ui/recharts-tooltip"
import ChartDataTable from "./ChartDataTable"
import HighlightPicker from "./HighlightPicker"
import Panel from "./Panel"
import { OpenButton, TapDetails } from "./TapDetails"

const chartConfig = {
  point: { label: "Point" },
} satisfies ChartConfig

// A point on the chart is either its own row (the common case) or a cluster
// of rows that landed on the exact same (x, y) - e.g. two WRs both sitting
// at 0 receptions/0 TDs. Un-clustered, a coincidence like that means one
// marker silently draws over the other; grouping them here lets the chart
// show every row as one visible, hoverable thing instead of hiding most of
// them behind whichever happened to draw last.
export type PlotPoint<Row> =
  | { kind: "solo"; x: number; y: number; row: Row }
  | { kind: "cluster"; x: number; y: number; members: Row[] }

export function groupCoincidentPoints<Row>(rows: (Row & { x: number; y: number })[]): PlotPoint<Row>[] {
  const groups = new Map<string, (Row & { x: number; y: number })[]>()
  for (const row of rows) {
    const key = `${row.x},${row.y}`
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }
  return [...groups.values()].map((group) =>
    group.length === 1
      ? { kind: "solo", x: group[0].x, y: group[0].y, row: group[0] }
      : { kind: "cluster", x: group[0].x, y: group[0].y, members: group },
  )
}

// The highlighted row comes out of any tie cluster and goes last, since SVG
// draws later marks on top - so it's never hidden behind its neighbors.
export function withHighlightedOnTop<Row>(
  rows: (Row & { x: number; y: number })[],
  highlightedId: string | null,
  rowId: (row: Row) => string,
): PlotPoint<Row>[] {
  const picked = rows.filter((row) => rowId(row) === highlightedId)
  const rest = rows.filter((row) => rowId(row) !== highlightedId)
  return [
    ...groupCoincidentPoints(rest),
    ...picked.map((row): PlotPoint<Row> => ({ kind: "solo", x: row.x, y: row.y, row })),
  ]
}

// Label for a highlighted mark: above it, or below when it sits near the top edge.
function HighlightLabel({ cx, cy, text }: { cx: number; cy: number; text: string }) {
  return (
    <text
      x={cx}
      y={cy < 32 ? cy + 28 : cy - 19}
      textAnchor="middle"
      fontSize={11}
      fontWeight={700}
      fill="var(--text-primary)"
      stroke="var(--surface-1)"
      strokeWidth={3}
      paintOrder="stroke"
      pointerEvents="none"
    >
      {text}
    </text>
  )
}

// Radius grows with count but flattens out - a 30-way tie shouldn't dwarf
// the plot, it just needs to read as "clearly the biggest cluster here."
function clusterRadius(count: number): number {
  return Math.min(9 + Math.sqrt(count) * 3.2, 26)
}

// Tapping a cluster on a touchscreen lists its members below the chart.
function ClusterBadge({
  cx,
  cy,
  count,
  selected,
  onSelect,
}: {
  cx?: number
  cy?: number
  count: number
  selected: boolean
  onSelect: () => void
}) {
  if (cx === undefined || cy === undefined) return null
  return (
    <g onClick={onSelect}>
      <circle
        cx={cx}
        cy={cy}
        r={clusterRadius(count)}
        fill="var(--accent)"
        fillOpacity={selected ? 0.35 : 0.15}
        stroke="var(--accent)"
        strokeWidth={1.5}
      />
      <text
        x={cx}
        y={cy}
        dy={3.5}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="var(--accent)"
      >
        ×{count}
      </text>
    </g>
  )
}

// Reuses the caller's own header renderer per member (so a player's
// headshot or a team's logo still shows up correctly) rather than
// inventing a separate generic member-list rendering.
function ClusterTooltipHeader<Row>({
  members,
  renderHeader,
}: {
  members: Row[]
  renderHeader: (row: Row) => ReactNode
}) {
  const MAX_SHOWN = 5
  const shown = members.slice(0, MAX_SHOWN)
  const rest = members.length - shown.length
  return (
    <div className="grid gap-1.5">
      <div className="font-medium text-[var(--text-primary)]">{members.length} tied at this point</div>
      {shown.map((member, index) => (
        <div key={index}>{renderHeader(member)}</div>
      ))}
      {rest > 0 && <div className="text-[10px] text-[var(--text-muted)] italic">+{rest} more</div>}
    </div>
  )
}

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
  // The marker. Clicking it (or Enter) must call `onSelect`; `selected` marks the highlighted one.
  Dot: (props: { cx?: number; cy?: number; payload?: Row; selected?: boolean; onSelect?: () => void }) => ReactElement | null
  // Names a row in the chart's data table, e.g. the player or team name.
  rowName: (row: Row) => string
  // Stable id for a row (player or team id), for highlighting.
  rowId: (row: Row) => string
  // How a row reads in the highlight search, when the name alone could be ambiguous. Defaults to rowName.
  searchLabel?: (row: Row) => string
  // Opens a row's page: a click on the already-highlighted mark, or the touchscreen "View" button.
  onOpen?: (row: Row) => void
  // Shown below the chart on a touchscreen before anything is tapped.
  tapPrompt: string
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
  rowName,
  rowId,
  searchLabel = rowName,
  onOpen,
  tapPrompt,
  renderTooltipHeader,
}: MetricScatterProps<Row>) {
  const [xKey, setXKey] = useState(initialX)
  const [yKey, setYKey] = useState(initialY)
  // The highlighted row's id, or a tie cluster's key (touchscreens list its members below the chart).
  const [selected, setSelected] = useState<string | null>(null)

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

  // Re-grouped whenever the chosen axes change, since which rows coincide
  // depends entirely on the two stats currently picked.
  // Not memoized: callers pass a new rowId every render, and the inline `shape`
  // below redraws every mark on each render regardless.
  const plotPoints = points ? withHighlightedOnTop(points, selected, rowId) : null
  // Undefined when nothing's selected, a cluster is, or the row is gone (e.g. after a refetch).
  const highlightedRow = rows?.find((row) => rowId(row) === selected)

  const xDomain = useMemo(() => valueDomain(points?.map((p) => p.x) ?? []), [points])
  const yDomain = useMemo(() => valueDomain(points?.map((p) => p.y) ?? []), [points])

  const optionByLabel = new Map(metrics.map((metric) => [metric.label, metric]))

  const touchScreen = useMediaQuery(TOUCH_QUERY)
  const pointKey = (point: PlotPoint<Row>) => (point.kind === "solo" ? rowId(point.row) : `cluster:${point.x},${point.y}`)
  const pointByKey = new Map(plotPoints?.map((point) => [pointKey(point), point]))
  // Gone if the axes changed and a selected cluster split up.
  const selectedPoint = selected === null ? undefined : pointByKey.get(selected)

  // First click highlights a mark; a second click on it opens its page.
  function select(key: string) {
    const point = pointByKey.get(key)
    if (key === selected && point?.kind === "solo") onOpen?.(point.row)
    else setSelected(key)
  }

  return (
    <Panel title={title}>
      <div className="flex flex-wrap items-center justify-center gap-3 border-b border-[var(--border)] px-4 py-3">
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
        {rows && rows.length > 0 && (
          <HighlightPicker
            noun={noun}
            options={rows.map((row) => ({ id: rowId(row), label: searchLabel(row) }))}
            picked={highlightedRow ? { id: rowId(highlightedRow), label: searchLabel(highlightedRow) } : null}
            onPick={setSelected}
            onClear={() => setSelected(null)}
          />
        )}
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
          {/* A click or tap on empty chart space (not a mark) clears the highlight. */}
          <div
            onClick={(event) => !(event.target as Element).closest(".recharts-scatter-symbol") && setSelected(null)}
          >
            <ChartContainer
              config={chartConfig}
              className="aspect-[3/2]"
              label={`${title}: ${points.length} ${noun} plotted by ${xMetric.label} (across) and ${yMetric.label} (up). Lines mark the median in each stat.${
                highlightedRow ? ` Highlighted: ${rowName(highlightedRow)}.` : ""
              }`}
            >
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
                {/* On a touchscreen, the details box below stands in for the tooltip. */}
                {!touchScreen && (
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        variant="frosted-glass"
                        hideIndicator
                        labelFormatter={(_, items) => {
                          const point = items[0]?.payload as PlotPoint<Row> | undefined
                          if (!point) return null
                          return point.kind === "cluster" ? (
                            <ClusterTooltipHeader members={point.members} renderHeader={renderTooltipHeader} />
                          ) : (
                            renderTooltipHeader(point.row)
                          )
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
                )}
                <Scatter
                  data={plotPoints ?? []}
                  shape={(props: { cx?: number; cy?: number; payload?: PlotPoint<Row> }) => {
                    const point = props.payload
                    if (!point) return null
                    const key = pointKey(point)
                    const picked = point.kind === "solo" && key === selected
                    const mark =
                      point.kind === "cluster" ? (
                        <ClusterBadge
                          cx={props.cx}
                          cy={props.cy}
                          count={point.members.length}
                          selected={key === selected}
                          onSelect={() => select(key)}
                        />
                      ) : (
                        <Dot
                          cx={props.cx}
                          cy={props.cy}
                          payload={point.row}
                          selected={picked}
                          onSelect={() => select(key)}
                        />
                      )
                    if (picked && props.cx !== undefined && props.cy !== undefined) {
                      return (
                        <g>
                          {mark}
                          <HighlightLabel cx={props.cx} cy={props.cy} text={rowName(point.row)} />
                        </g>
                      )
                    }
                    return highlightedRow ? <g opacity={0.25}>{mark}</g> : mark
                  }}
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ChartContainer>
          </div>
          {touchScreen && (
            // The tallest filled box at default axes (146px: a team's values wrap on
            // a 360px phone), so the first tap doesn't shift what's below. A tied
            // cluster lists its members and runs taller.
            <TapDetails prompt={tapPrompt} className="min-h-37">
              {selectedPoint && (
                <div className="flex flex-col gap-1.5">
                  {selectedPoint.kind === "cluster" ? (
                    <ClusterTooltipHeader members={selectedPoint.members} renderHeader={renderTooltipHeader} />
                  ) : (
                    renderTooltipHeader(selectedPoint.row)
                  )}
                  <TooltipRow name={xMetric.label} value={selectedPoint.x} unit={xMetric.unit} offset={selectedPoint.x - xMedian} />
                  <TooltipRow name={yMetric.label} value={selectedPoint.y} unit={yMetric.unit} offset={selectedPoint.y - yMedian} />
                  {selectedPoint.kind === "solo" && onOpen && (
                    <OpenButton name={rowName(selectedPoint.row)} onClick={() => onOpen(selectedPoint.row)} />
                  )}
                </div>
              )}
            </TapDetails>
          )}
          <p className="pt-2 text-xs text-[var(--text-muted)]">{caption}</p>
          <ChartDataTable
            caption={`${xMetric.label} and ${yMetric.label} for each of the ${noun}`}
            columns={["Name", xMetric.label, yMetric.label]}
            rows={points.map((point) => [
              rowName(point),
              formatValue(point.x, xMetric.unit),
              formatValue(point.y, yMetric.unit),
            ])}
          />
        </div>
      )}
    </Panel>
  )
}

export default MetricScatter
