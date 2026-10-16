// TrendChart.tsx
// Week-by-week line chart of whatever is trending up or down the most in a
// user-picked stat - shared by Trending Players and Trending Teams. The caller
// decides which lines qualify (top 5 up and top 5 down, see topTrends in
// trendingPlayers.ts) - plotting a whole pool turns into an unreadable
// tangle. Lines are colored by direction only (not good/bad - trending up in
// Interceptions isn't good). Hovering anywhere on a line - not just its
// endpoint marker, which sits right at the plot's edge and was an unreliable
// click target - shows its weekly numbers and slope; with `onSelect`,
// clicking it does too. On a touchscreen, where nothing hovers, the first tap
// on a line shows its numbers in a box below the chart (so the chart stays
// clear to tap the next line), and a second tap or the box's button opens its page.
// The Create page reuses it for lines the user picked: each line brings its
// own color, and `summary` describes the chart in place of "trending".
import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from "react"
import type * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { formatValue, roundTo, type MetricFormat, type PlayerMetric } from "../data/playerMetrics"
import type { TeamInfo } from "../data/teams"
import type { TrendLine } from "../data/trendingPlayers"
import { activateOnKey } from "../lib/activateOnKey"
import { initialsFor, readableTextColor } from "../lib/playerVisuals"
import { useFetch } from "../lib/useFetch"
import { TOUCH_QUERY, useMediaQuery } from "../lib/useMediaQuery"
import { useTapToOpen } from "../lib/useTapToOpen"
import AxisSelect from "./AxisSelect"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import ChartDataTable from "./ChartDataTable"
import Panel from "./Panel"
import { OpenButton, TapDetails } from "./TapDetails"
import { BADGE_FILL, TeamLogoBadge } from "./TeamLogo"

const UP_COLOR = "var(--accent)"
const DOWN_COLOR = "#b45309"
const ENDPOINT_RADIUS = 10
const DIMMED_OPACITY = 0.15
// The visible stroke is only 2-3px - an invisible line drawn on top at this
// width is the actual hover/click target, so you don't need to be pixel-
// precise on the curve itself. Wide enough to forgive a few px of imprecision,
// not so wide it starts stealing hover from a line running close alongside.
const HIT_STROKE_WIDTH = 10
const CARD_OFFSET = 14
const ENDPOINT_LOGO_SIZE = 14

// "+198.0/wk" - the slope, signed, with a true minus sign and "per week" so
// it reads as a rate rather than a plain stat value.
function formatSlope(value: number, format: MetricFormat): string {
  const rounded = roundTo(value, format.decimals)
  const sign = rounded === 0 ? "" : rounded > 0 ? "+" : "−"
  return `${sign}${Math.abs(rounded).toLocaleString()}${format.unit ?? ""}/wk`
}

interface LineMeta {
  line: TrendLine
  color: string
  teamColor: string
  lastWeek: number
}

// A small dot at every real data point, and a badge (team-colored initials, or
// a team logo) at each line's own last played week (which may be earlier than
// the chart's last week, after a bye). recharts renders a Line's dots as
// siblings of its curve, not descendants of it, so the badge identifies itself
// with data-badge-for: the chart container resolves both hover and clicks from
// whatever is under the pointer (see resolveHoveredId), badge or line. The
// badge only handles keyboard activation itself.
function makeDot(meta: LineMeta, onSelect?: () => void) {
  return (props: { cx?: number; cy?: number; payload?: { week: number } & Record<string, unknown> }) => {
    const { cx, cy, payload } = props
    if (cx === undefined || cy === undefined || !payload) return <g />
    const value = payload[meta.line.id]
    if (value === null || value === undefined) return <g />

    if (payload.week !== meta.lastWeek) {
      // Not a click target - these small markers often sit close enough
      // together (or to a neighboring endpoint badge) that giving them their
      // own hit area just steals clicks meant for something else nearby.
      return <circle cx={cx} cy={cy} r={3} fill={meta.color} style={{ pointerEvents: "none" }} />
    }

    const { logo } = meta.line
    const clickProps = onSelect && {
      role: "button",
      tabIndex: 0,
      onKeyDown: activateOnKey(onSelect),
      "aria-label": `View ${meta.line.name}'s page`,
      className: "cursor-pointer",
    }

    return (
      <g data-badge-for={meta.line.id} {...clickProps}>
        <circle
          cx={cx}
          cy={cy}
          r={ENDPOINT_RADIUS}
          fill={logo ? BADGE_FILL : meta.teamColor}
          stroke="var(--surface-1)"
          strokeWidth={2}
        />
        {logo ? (
          <image
            href={logo}
            x={cx - ENDPOINT_LOGO_SIZE / 2}
            y={cy - ENDPOINT_LOGO_SIZE / 2}
            width={ENDPOINT_LOGO_SIZE}
            height={ENDPOINT_LOGO_SIZE}
            style={{ pointerEvents: "none" }}
          />
        ) : (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fontWeight={700}
            fill={readableTextColor(meta.teamColor)}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {initialsFor(meta.line.name)}
          </text>
        )}
      </g>
    )
  }
}

// Badge (logo, or team-colored initials), name, and team - the top of both the
// hover card and the touchscreen details box.
function LineIdentity({ meta }: { meta: LineMeta }) {
  const { line, teamColor } = meta
  return (
    <div className="flex items-center gap-2">
      {line.logo ? (
        <TeamLogoBadge logo={line.logo} size="h-6 w-6" />
      ) : (
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
          style={{ backgroundColor: teamColor, color: readableTextColor(teamColor) }}
        >
          {initialsFor(line.name)}
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate font-medium text-[var(--text-primary)]">{line.name}</div>
        <div className="text-[10px] tracking-wider text-[var(--text-muted)] uppercase">{line.team}</div>
      </div>
    </div>
  )
}

// Touchscreen stand-in for the hover card, under the chart instead of over
// it: weeks run in a wrapping row rather than a column, to stay short.
function LineDetails({ meta, format, onOpen }: { meta: LineMeta; format: MetricFormat; onOpen?: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <LineIdentity meta={meta} />
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[var(--text-secondary)]">
        {meta.line.games.map((game) => (
          <span key={game.week}>
            Wk {game.week}{" "}
            <span className="font-mono tabular-nums text-[var(--text-primary)]">{formatValue(game.value, format)}</span>
          </span>
        ))}
        <span>
          Slope{" "}
          <span className="font-mono tabular-nums text-[var(--text-primary)]">{formatSlope(meta.line.slope, format)}</span>
        </span>
      </div>
      {onOpen && <OpenButton name={meta.line.name} onClick={onOpen} />}
    </div>
  )
}

// Pointer-events-none: the card follows the cursor closely enough that it
// would otherwise end up sitting right under it, and hovering the card
// itself would keep hoveredId alive after the cursor left the actual line -
// hover state must only ever be driven by the line/dot underneath.
const LineHoverCard = forwardRef<
  HTMLDivElement,
  {
    meta: LineMeta
    format: MetricFormat
    style?: React.CSSProperties
    // Shown on a touchscreen when tapping the line again opens its page.
    hint?: string
  }
>(function LineHoverCard({ meta, format, style, hint }, ref) {
  const { line } = meta
  return (
    <div
      ref={ref}
      style={{ ...style, pointerEvents: "none" }}
      className="absolute z-10 w-44 rounded-md border border-[var(--border)] bg-[var(--surface-2)]/90 p-2.5 text-xs shadow-lg backdrop-blur-sm"
    >
      <div className="mb-1.5">
        <LineIdentity meta={meta} />
      </div>
      <div className="space-y-0.5">
        {line.games.map((game) => (
          <div key={game.week} className="flex items-center justify-between text-[var(--text-secondary)]">
            <span>Week {game.week}</span>
            <span className="font-mono tabular-nums text-[var(--text-primary)]">
              {formatValue(game.value, format)}
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-[var(--border)] pt-1 font-medium">
          <span className="text-[var(--text-secondary)]">Slope</span>
          <span className="font-mono tabular-nums text-[var(--text-primary)]">
            {formatSlope(line.slope, format)}
          </span>
        </div>
      </div>
      {hint && <div className="mt-1.5 text-[10px] text-[var(--text-muted)]">{hint}</div>}
    </div>
  )
})

interface TrendChartProps {
  title: string
  metrics: PlayerMetric[]
  // For the caption, e.g. "QBs"/"player" or "teams"/"team".
  plural: string
  singular: string
  loading: boolean
  error: string | null
  // Lines to plot for a metric - memoize it (useCallback) so hovering doesn't recompute trends.
  trends: (metric: PlayerMetric) => { up: TrendLine[]; down: TrendLine[] }
  onSelect?: (line: TrendLine) => void
  // Replaces the "trending up or down" description (chart label and caption)
  // and drops the table's Trend column - for lines that weren't picked by trend.
  summary?: string
  // Between the caption and the data table, e.g. a stat glossary.
  footer?: React.ReactNode
}

function TrendChart({
  title,
  metrics,
  plural,
  singular,
  loading,
  error,
  trends,
  onSelect,
  summary,
  footer,
}: TrendChartProps) {
  const [statKey, setStatKey] = useState(metrics[0].key)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [cardStyle, setCardStyle] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const touchScreen = useMediaQuery(TOUCH_QUERY)

  // Hovering many crossing diagonal lines with per-element onMouseEnter/
  // onMouseLeave is unreliable - a mouseenter on one line's invisible hit
  // corridor can fire without ever getting a matching mouseleave once the
  // cursor drifts over a neighboring line's corridor, leaving hoveredId
  // "stuck" on whatever it last resolved to. Recomputing from scratch on
  // every mousemove tick (via the browser's own hit-test) is self-correcting
  // instead: hover state can never fall out of sync with what's actually
  // under the cursor.
  //
  // The hit line's `name` prop is set to its player id (see below) so it can
  // be read straight off the DOM - recharts does NOT keep <Line> curves in
  // JSX source order once the data changes (switching the stat reorders
  // which players are "up"/"down", which reshuffles the actual DOM order of
  // the <path> elements), so mapping a hovered path back to a player by its
  // position among the curves breaks the moment you switch stats.
  function resolveHoveredId(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) return null
    const badge = el.closest("[data-badge-for]")
    if (badge) return badge.getAttribute("data-badge-for")
    if (el.getAttribute("stroke") !== "transparent" || !el.classList.contains("recharts-line-curve")) return null
    return el.getAttribute("name")
  }

  function moveCursor(event: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current!.getBoundingClientRect()
    setCursorPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  // Only a mouse hovers: a finger's pointermove is a scroll, and its
  // pointerleave fires on every lift, which would hide a line just tapped.
  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return
    moveCursor(event)
    setHoveredId(resolveHoveredId(event.clientX, event.clientY))
  }

  const metric = metrics.find((m) => m.key === statKey) ?? metrics[0]

  const teams = useFetch<TeamInfo[]>("/teams")

  const { up, down } = useMemo(() => trends(metric), [trends, metric])

  const colorByTeam = useMemo(
    () => new Map(teams.data?.map((team) => [team.team_abbr, team.team_color])),
    [teams.data],
  )

  const lineMetas = useMemo<LineMeta[]>(() => {
    const all = [
      ...up.map((line) => ({ line, color: UP_COLOR })),
      ...down.map((line) => ({ line, color: DOWN_COLOR })),
    ]
    return all.map(({ line, color }) => ({
      line,
      color: line.color ?? color,
      teamColor: colorByTeam.get(line.team) ?? "var(--accent)",
      lastWeek: line.games[line.games.length - 1]?.week ?? 0,
    }))
  }, [up, down, colorByTeam])

  const weeks = useMemo(
    () => [...new Set(lineMetas.flatMap((m) => m.line.games.map((g) => g.week)))].sort((a, b) => a - b),
    [lineMetas],
  )

  // Wide format: one row per week, one column per shown player. A missed week
  // is null and the line bridges it (connectNulls) - breaking it instead left
  // a player with games only on either side of the gap (e.g. weeks 1 and 3)
  // as two lone points with no curve to hover. The hover card still lists
  // only the weeks actually played.
  const chartData = useMemo(
    () =>
      weeks.map((week) => {
        const row: Record<string, number | null> = { week }
        for (const meta of lineMetas) {
          row[meta.line.id] = meta.line.games.find((g) => g.week === week)?.value ?? null
        }
        return row
      }),
    [weeks, lineMetas],
  )

  const chartConfig = useMemo(
    () => Object.fromEntries(lineMetas.map((m) => [m.line.id, { label: m.line.name }])) as ChartConfig,
    [lineMetas],
  )

  const optionByLabel = new Map(metrics.map((m) => [m.label, m]))
  // A mouse click opens a line; a tap selects it (a second tap opens it).
  const tap = useTapToOpen<string>((id) => {
    const line = lineMetas.find((m) => m.line.id === id)?.line
    if (line && onSelect) onSelect(line)
  })
  // The line on show: hovered with a mouse, or selected by a tap.
  const activeId = hoveredId ?? tap.selected
  const activeMeta = lineMetas.find((m) => m.line.id === activeId)

  // A click, not pointerdown, so a scroll that starts on a line never opens it.
  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    moveCursor(event)
    tap.tap(resolveHoveredId(event.clientX, event.clientY))
  }

  // Re-measures the card itself (its height depends on how many weeks of
  // data the hovered player has) so it can be clamped inside the chart area
  // instead of spilling past the edge when the cursor is near a boundary.
  useLayoutEffect(() => {
    if (!cursorPos || !activeId || !cardRef.current || !containerRef.current) return
    const container = containerRef.current.getBoundingClientRect()
    const card = cardRef.current.getBoundingClientRect()
    const left = Math.min(Math.max(cursorPos.x + CARD_OFFSET, 8), container.width - card.width - 8)
    const top = Math.min(Math.max(cursorPos.y + CARD_OFFSET, 8), container.height - card.height - 8)
    setCardStyle({ left, top })
  }, [cursorPos, activeId])

  return (
    <Panel title={title}>
      {metrics.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <AxisSelect
            label="Stat"
            value={metric.label}
            options={metrics.map((m) => m.label)}
            onChange={(label) => {
              setStatKey(optionByLabel.get(label)?.key ?? metrics[0].key)
              // Switching the stat swaps out which lines qualify and what they
              // look like - a hoveredId left over from the previous stat could
              // point at a line that isn't plotted anymore, or a stale position
              // for one that is. Drop it so hover starts clean.
              setHoveredId(null)
              tap.tap(null)
            }}
          />
        </div>
      )}
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load {plural}: {error}</p>}
      {!loading && !error && lineMetas.length === 0 && (
        <p className="p-4 text-sm text-[var(--text-secondary)]">
          {summary ? "No games to show yet." : `Not enough games yet to spot a trend in ${metric.label.toLowerCase()}.`}
        </p>
      )}
      {lineMetas.length > 0 && (
        <div ref={containerRef} className="relative p-3">
          {/* Pointer handling covers the chart alone, so taps on the details
              box, caption, or data table never count as tapping empty chart. */}
          <div
            onPointerDown={tap.onPointerDown}
            onPointerMove={handlePointerMove}
            onPointerLeave={(event) => event.pointerType === "mouse" && setHoveredId(null)}
            onClick={handleClick}
          >
            <ChartContainer
              config={chartConfig}
              className="aspect-[3/2]"
              label={`${title}: ${summary ?? `the ${lineMetas.length} ${plural} trending up or down the most in ${metric.label.toLowerCase()}`}, week ${weeks[0]} to week ${weeks[weeks.length - 1]}.`}
            >
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 24, left: 4 }}>
                <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} />
                <XAxis
                  type="number"
                  dataKey="week"
                  domain={[weeks[0], weeks[weeks.length - 1]]}
                  ticks={weeks}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  label={{
                    value: "Week",
                    position: "insideBottom",
                    offset: -14,
                    fill: "var(--text-secondary)",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
                <YAxis
                  tickFormatter={(value) => formatValue(Number(value), metric)}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  width={54}
                  label={{
                    value: metric.label,
                    angle: -90,
                    position: "insideLeft",
                    offset: 4,
                    style: { textAnchor: "middle" },
                    fill: "var(--text-secondary)",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
                {lineMetas.map((meta) => (
                  <Line
                    key={meta.line.id}
                    dataKey={meta.line.id}
                    stroke={meta.color}
                    strokeWidth={activeId === meta.line.id ? 3 : 2}
                    strokeOpacity={activeId === null || activeId === meta.line.id ? 1 : DIMMED_OPACITY}
                    connectNulls
                    type="monotone"
                    isAnimationActive={false}
                    dot={false}
                    activeDot={false}
                    legendType="none"
                  />
                ))}
                {/* Invisible wide-stroke lines on top of the visible ones - the
                    real hover/click target, so you don't need to land on the
                    thin 2-3px curve exactly. `name` carries the line's id so
                    resolveHoveredId can read it straight off the DOM instead of
                    assuming curve order, which recharts doesn't preserve. */}
                {lineMetas.map((meta) => (
                  <Line
                    key={`${meta.line.id}-hit`}
                    dataKey={meta.line.id}
                    name={meta.line.id}
                    stroke="transparent"
                    strokeWidth={HIT_STROKE_WIDTH}
                    connectNulls
                    type="monotone"
                    isAnimationActive={false}
                    className={onSelect ? "cursor-pointer" : undefined}
                    dot={makeDot(meta, onSelect && (() => onSelect(meta.line)))}
                    activeDot={false}
                    legendType="none"
                  />
                ))}
              </LineChart>
            </ChartContainer>
          </div>
          {touchScreen && (
            // Held at a filled box's height (109-127px with four weeks of
            // games) even before a tap, so showing a line - or switching lines -
            // doesn't push the caption and table around. Longer seasons wrap
            // the week row onto more lines and grow it a little.
            <TapDetails prompt={`Tap a line to see that ${singular}'s numbers.`} className="min-h-32">
              {activeMeta && (
                <LineDetails
                  meta={activeMeta}
                  format={metric}
                  onOpen={onSelect && (() => onSelect(activeMeta.line))}
                />
              )}
            </TapDetails>
          )}
          {activeMeta && !touchScreen && (
            <LineHoverCard
              ref={cardRef}
              meta={activeMeta}
              format={metric}
              style={cardStyle}
              // Tapped on a device that also hovers (a touchscreen laptop).
              hint={onSelect && hoveredId === null ? "Tap the line again to open" : undefined}
            />
          )}
          <p className="pt-2 text-xs text-[var(--text-muted)]">
            {summary ? (
              `${summary[0].toUpperCase()}${summary.slice(1)}.`
            ) : (
              <>
                The {lineMetas.length} {plural} trending up (blue) or down (amber) the most in{" "}
                {metric.label.toLowerCase()} over the last {weeks.length} week
                {weeks.length === 1 ? "" : "s"}.
              </>
            )}
            {/* On a touchscreen the box above already says to tap a line. */}
            {!touchScreen &&
              ` Hover ${onSelect ? "or click " : ""}a line to see that ${singular}'s numbers${onSelect ? " and go to their page" : ""}.`}
          </p>
          {footer}
          <ChartDataTable
            caption={`Weekly ${metric.label.toLowerCase()} for ${summary ? `the ${plural} shown` : `the ${plural} trending the most`}`}
            columns={[
              singular[0].toUpperCase() + singular.slice(1),
              ...(summary ? [] : ["Trend"]),
              ...weeks.map((week) => `Wk ${week}`),
            ]}
            rows={lineMetas.map((meta) => [
              meta.line.name,
              ...(summary ? [] : [meta.color === UP_COLOR ? "Up" : "Down"]),
              ...weeks.map((week) => {
                const game = meta.line.games.find((g) => g.week === week)
                return game ? formatValue(game.value, metric) : null
              }),
            ])}
          />
        </div>
      )}
    </Panel>
  )
}

export default TrendChart
