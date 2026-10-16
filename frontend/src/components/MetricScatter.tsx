// MetricScatter.tsx
// Pick-your-axes scatterplot shared by Compare Players and Compare Teams: two
// metric pickers, median quadrant lines, and a tooltip. The caller supplies
// the rows, the marker, and the tooltip header. Built on the Evil Charts
// chart base. A mouse's hover and clicks go to the nearest mark within reach
// (see chartMarks), not whichever is drawn on top. Clicking a mark (or picking
// it in the search box) highlights it: drawn on top, ringed and labeled, with
// everything else faded. Clicking the highlighted mark again opens its page.
// On a touchscreen the tooltip is replaced by a details box below the chart.
import { type ReactElement, type ReactNode, useMemo, useState } from "react"
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis } from "recharts"
import { formatValue, meetsMinimum, metricMedian, roundTo, type MetricFormat, type PlayerMetric, type StatFields } from "../data/playerMetrics"
import { markUnder, nearestMarkAt, useHoveredMark } from "../lib/chartMarks"
import { TOUCH_QUERY, useMediaQuery } from "../lib/useMediaQuery"
import { useTapToOpen } from "../lib/useTapToOpen"
import AxisSelect from "./AxisSelect"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import ChartDataTable from "./ChartDataTable"
import HighlightPicker from "./HighlightPicker"
import Panel from "./Panel"
import { HoverCard, OpenButton, TapDetails } from "./TapDetails"

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
  hovered,
}: {
  cx?: number
  cy?: number
  count: number
  selected: boolean
  hovered: boolean
}) {
  if (cx === undefined || cy === undefined) return null
  return (
    <g className="cursor-pointer">
      <circle
        cx={cx}
        cy={cy}
        r={clusterRadius(count)}
        fill="var(--accent)"
        fillOpacity={selected ? 0.35 : hovered ? 0.25 : 0.15}
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

// "+120" / "−45" / "0" - for the tooltip's "how far from the median" note, in
// the metric's own unit rather than a statistical score.
function formatOffset(value: number, format: MetricFormat): string {
  const rounded = roundTo(value, format.decimals)
  if (rounded === 0) return `0${format.unit ?? ""}`
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toLocaleString()}${format.unit ?? ""}`
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
  format,
  offset,
}: {
  name: string
  value: number
  format: MetricFormat
  offset: number
}) {
  return (
    <div className="flex w-full items-baseline justify-between gap-4">
      <span className="text-[var(--text-secondary)]">{name}</span>
      <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
        {formatValue(value, format)}{" "}
        <span className="text-[10px] text-[var(--text-muted)]">
          ({formatOffset(offset, format)} vs. median)
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
  // The marker. Enter/Space on it must call `onSelect` (clicks are resolved by the chart); `selected`
  // marks the highlighted one and `hovered` the one nearest the mouse.
  Dot: (props: {
    cx?: number
    cy?: number
    payload?: Row
    selected?: boolean
    hovered?: boolean
    onSelect?: () => void
  }) => ReactElement | null
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
  const xMetric = metrics.find((metric) => metric.key === xKey) ?? metrics[0]
  const yMetric = metrics.find((metric) => metric.key === yKey) ?? metrics[0]
  // Rows with enough plays for both picked stats (see MinSample): a handful
  // of plays would stretch an axis and squash everyone else into a corner.
  // Everything below - medians, marks, search, table - uses only these.
  const shown = useMemo(
    () => rows?.filter((row) => meetsMinimum(row, xMetric) && meetsMinimum(row, yMetric)) ?? null,
    [rows, xMetric, yMetric],
  )
  // e.g. "Players with fewer than 25 dropbacks aren't shown, since Completion % and EPA / Dropback swing a lot on a handful of plays."
  const minimumNotes = [...new Set([xMetric.minSample, yMetric.minSample])].flatMap((sample) => {
    if (!sample) return []
    const labels = [...new Set([xMetric, yMetric].filter((m) => m.minSample === sample).map((m) => m.label))]
    return [
      `${noun[0].toUpperCase()}${noun.slice(1)} with fewer than ${sample.min} ${sample.noun} aren't shown, since ${labels.join(" and ")} ${labels.length > 1 ? "swing" : "swings"} a lot on a handful of plays.`,
    ]
  })

  // First click or tap highlights a mark; a second one on it opens its page.
  // `selected` is the highlighted row's id, or a tie cluster's key
  // (touchscreens list its members below the chart).
  const tap = useTapToOpen<string>(
    (key) => {
      // A solo mark's key is its row id; a cluster's matches no row, so it never opens.
      const row = shown?.find((r) => rowId(r) === key)
      if (row) onOpen?.(row)
    },
    { selectFirst: true },
  )
  const selected = tap.selected
  const hover = useHoveredMark()

  // The quadrant lines sit at the median, but each axis plots the real stat -
  // ticks, dot positions, and the tooltip's headline number are all in the
  // metric's own unit; only the tooltip's small "vs. median" note is an offset.
  const xMedian = useMemo(() => (shown ? metricMedian(shown, xMetric) : 0), [shown, xMetric])
  const yMedian = useMemo(() => (shown ? metricMedian(shown, yMetric) : 0), [shown, yMetric])

  const points = useMemo(
    () => shown?.map((row) => ({ ...row, x: xMetric.value(row), y: yMetric.value(row) })) ?? null,
    [shown, xMetric, yMetric],
  )

  // Re-grouped whenever the chosen axes change, since which rows coincide
  // depends entirely on the two stats currently picked.
  // Not memoized: callers pass a new rowId every render, and the inline `shape`
  // below redraws every mark on each render regardless.
  const plotPoints = points ? withHighlightedOnTop(points, selected, rowId) : null
  // Undefined when nothing's selected, a cluster is, or the row is gone (e.g. after a refetch).
  const highlightedRow = shown?.find((row) => rowId(row) === selected)

  const xDomain = useMemo(() => valueDomain(points?.map((p) => p.x) ?? []), [points])
  const yDomain = useMemo(() => valueDomain(points?.map((p) => p.y) ?? []), [points])

  const optionByLabel = new Map(metrics.map((metric) => [metric.label, metric]))

  const touchScreen = useMediaQuery(TOUCH_QUERY)
  const pointKey = (point: PlotPoint<Row>) => (point.kind === "solo" ? rowId(point.row) : `cluster:${point.x},${point.y}`)
  const pointByKey = new Map(plotPoints?.map((point) => [pointKey(point), point]))
  // Gone if the axes changed and a selected cluster split up.
  const selectedPoint = selected === null ? undefined : pointByKey.get(selected)
  const hoveredPoint = hover.hovered && pointByKey.get(hover.hovered.key)

  // A point's name(s) and both values: the hover card's content, and the touchscreen box's.
  function pointDetails(point: PlotPoint<Row>) {
    return (
      <>
        {point.kind === "cluster" ? (
          <ClusterTooltipHeader members={point.members} renderHeader={renderTooltipHeader} />
        ) : (
          renderTooltipHeader(point.row)
        )}
        <TooltipRow name={xMetric.label} value={point.x} format={xMetric} offset={point.x - xMedian} />
        <TooltipRow name={yMetric.label} value={point.y} format={yMetric} offset={point.y - yMedian} />
      </>
    )
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
        {shown && shown.length > 0 && (
          <HighlightPicker
            noun={noun}
            options={shown.map((row) => ({ id: rowId(row), label: searchLabel(row) }))}
            picked={highlightedRow ? { id: rowId(highlightedRow), label: searchLabel(highlightedRow) } : null}
            onPick={tap.select}
            onClear={() => tap.select(null)}
          />
        )}
      </div>
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && (
        <p className="p-4 text-sm text-[var(--negative)]">
          Couldn't load {noun}: {error}
        </p>
      )}
      {points && points.length === 0 && (
        <p className="p-4 text-sm text-[var(--text-secondary)]">
          {/* Rows exist, but none has enough plays yet for the picked stats. */}
          {rows && rows.length > 0 ? minimumNotes.join(" ") : emptyText}
        </p>
      )}
      {points && points.length > 0 && (
        <div className="p-3">
          {/* Clicks resolve here, to the nearest mark for a mouse (a finger
              gets the mark it lands on); one on empty chart space clears the
              highlight. */}
          <div
            data-chart-marks
            className={`relative ${hover.hovered ? "cursor-pointer" : ""}`}
            {...tap.pressHandlers((x, y, pointerType) => (pointerType === "mouse" ? nearestMarkAt(x, y) : markUnder(x, y)))}
            {...hover.hoverHandlers}
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
                  tickFormatter={(value) => formatValue(Number(value), xMetric)}
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
                  tickFormatter={(value) => formatValue(Number(value), yMetric)}
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
                <Scatter
                  data={plotPoints ?? []}
                  shape={(props: { cx?: number; cy?: number; payload?: PlotPoint<Row> }) => {
                    const point = props.payload
                    if (!point) return null
                    const key = pointKey(point)
                    const picked = point.kind === "solo" && key === selected
                    const hovered = key === hover.hovered?.key
                    // data-tap-key marks what chartMarks measures, so the label stays outside it.
                    const mark = (
                      <g data-tap-key={key}>
                        {point.kind === "cluster" ? (
                          <ClusterBadge
                            cx={props.cx}
                            cy={props.cy}
                            count={point.members.length}
                            selected={key === selected}
                            hovered={hovered}
                          />
                        ) : (
                          <Dot
                            cx={props.cx}
                            cy={props.cy}
                            payload={point.row}
                            selected={picked}
                            hovered={hovered}
                            onSelect={() => tap.tap(key)}
                          />
                        )}
                      </g>
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
            {!touchScreen && hover.hovered && hoveredPoint && <HoverCard mark={hover.hovered}>{pointDetails(hoveredPoint)}</HoverCard>}
          </div>
          {touchScreen && (
            // The tallest filled box at default axes (146px: a team's values wrap on
            // a 360px phone), so the first tap doesn't shift what's below. A tied
            // cluster lists its members and runs taller.
            <TapDetails prompt={tapPrompt} className="min-h-37">
              {selectedPoint && (
                <div className="flex flex-col gap-1.5">
                  {pointDetails(selectedPoint)}
                  {selectedPoint.kind === "solo" && onOpen && (
                    <OpenButton name={rowName(selectedPoint.row)} onClick={() => onOpen(selectedPoint.row)} />
                  )}
                </div>
              )}
            </TapDetails>
          )}
          <p className="pt-2 text-xs text-[var(--text-muted)]">{caption}</p>
          {minimumNotes.map((note) => (
            <p key={note} className="pt-1 text-xs text-[var(--text-muted)]">
              {note}
            </p>
          ))}
          <ChartDataTable
            caption={`${xMetric.label} and ${yMetric.label} for each of the ${noun}`}
            columns={["Name", xMetric.label, yMetric.label]}
            rows={points.map((point) => [
              rowName(point),
              formatValue(point.x, xMetric),
              formatValue(point.y, yMetric),
            ])}
          />
        </div>
      )}
    </Panel>
  )
}

export default MetricScatter
