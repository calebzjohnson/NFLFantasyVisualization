// TrendingPlayersChart.tsx
// Week-by-week line chart of the players trending up or down the most in a
// user-picked stat, for the active position. Only the top 5 up and top 5
// down (see trendingPlayers.ts) ever get a line - the full position pool is
// too large to plot without it turning into an unreadable tangle. Lines are
// colored by direction only (not good/bad - trending up in Interceptions
// isn't good). Hovering or clicking anywhere on a line - not just its
// endpoint marker, which sits right at the plot's edge and was an unreliable
// click target - shows that player's weekly numbers and slope, or opens
// their page.
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { useNavigate } from "react-router-dom"
import type { PositionGroup } from "../data/leaderCategories"
import { PLAYER_METRICS, playersWeeklyPathForPosition } from "../data/playerMetrics"
import type { TeamInfo } from "../data/teams"
import { trendingPlayers, type TrendLine, type WeeklyPlayerRow } from "../data/trendingPlayers"
import { initialsFor, readableTextColor } from "../lib/playerVisuals"
import { useFetch } from "../lib/useFetch"
import AxisSelect from "./AxisSelect"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import Panel from "./Panel"

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

function formatValue(value: number, unit?: string): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10
  return `${rounded.toLocaleString()}${unit ?? ""}`
}

// "+198.0/wk" - the slope, signed, with a true minus sign and "per week" so
// it reads as a rate rather than a plain stat value.
function formatSlope(value: number, unit?: string): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10
  const sign = rounded === 0 ? "" : rounded > 0 ? "+" : "−"
  return `${sign}${Math.abs(rounded).toLocaleString()}${unit ?? ""}/wk`
}

interface LineMeta {
  line: TrendLine
  color: string
  teamColor: string
  lastWeek: number
}

// A small dot at every real data point, and a team-badge at each line's own
// last played week (which may be earlier than the chart's last week, if that
// player had the most recent bye). recharts renders a Line's dots as
// siblings of its curve, not descendants of it - a click on a dot never
// bubbles to the <Line>'s own onClick, which is exactly why the endpoint
// badge (sitting right at the plot's edge, where people naturally click)
// used to be dead. So the badge gets its own click handler here too.
// data-badge-for identifies it to the hover resolver (see resolveHoveredId).
function makeDot(meta: LineMeta, onSelect: () => void) {
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

    return (
      <g
        data-badge-for={meta.line.id}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSelect()
        }}
        aria-label={`View ${meta.line.name}'s player page`}
        className="cursor-pointer"
      >
        <circle
          cx={cx}
          cy={cy}
          r={ENDPOINT_RADIUS}
          fill={meta.teamColor}
          stroke="var(--surface-1)"
          strokeWidth={2}
        />
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
      </g>
    )
  }
}

// Pointer-events-none: the card follows the cursor closely enough that it
// would otherwise end up sitting right under it, and hovering the card
// itself would keep hoveredId alive after the cursor left the actual line -
// hover state must only ever be driven by the line/dot underneath.
const LineHoverCard = forwardRef<
  HTMLDivElement,
  {
    meta: LineMeta
    unit?: string
    style?: React.CSSProperties
  }
>(function LineHoverCard({ meta, unit, style }, ref) {
  const { line, teamColor } = meta
  return (
    <div
      ref={ref}
      style={{ ...style, pointerEvents: "none" }}
      className="absolute z-10 w-44 rounded-md border border-[var(--border)] bg-[var(--surface-2)]/90 p-2.5 text-xs shadow-lg backdrop-blur-sm"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
          style={{ backgroundColor: teamColor, color: readableTextColor(teamColor) }}
        >
          {initialsFor(line.name)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--text-primary)]">{line.name}</div>
          <div className="text-[10px] tracking-wider text-[var(--text-muted)] uppercase">{line.team}</div>
        </div>
      </div>
      <div className="space-y-0.5">
        {line.games.map((game) => (
          <div key={game.week} className="flex items-center justify-between text-[var(--text-secondary)]">
            <span>Week {game.week}</span>
            <span className="font-mono tabular-nums text-[var(--text-primary)]">
              {formatValue(game.value, unit)}
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-[var(--border)] pt-1 font-medium">
          <span className="text-[var(--text-secondary)]">Slope</span>
          <span className="font-mono tabular-nums text-[var(--text-primary)]">
            {formatSlope(line.slope, unit)}
          </span>
        </div>
      </div>
    </div>
  )
})

function TrendingPlayersChart({ position }: { position: PositionGroup }) {
  const navigate = useNavigate()
  const metrics = PLAYER_METRICS[position]
  const [statKey, setStatKey] = useState(metrics[0].key)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [cardStyle, setCardStyle] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setStatKey(metrics[0].key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position])

  // Switching the stat swaps out which players qualify and what their line
  // data looks like - a hoveredId left over from the previous stat could
  // point at a player who isn't even plotted anymore, or a stale position
  // for one who is. Drop it so hover state always starts clean for whatever
  // is now on screen.
  useEffect(() => {
    setHoveredId(null)
  }, [statKey])

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

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    setCursorPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    setHoveredId(resolveHoveredId(event.clientX, event.clientY))
  }

  // Re-measures the card itself (its height depends on how many weeks of
  // data the hovered player has) so it can be clamped inside the chart area
  // instead of spilling past the edge when the cursor is near a boundary.
  useLayoutEffect(() => {
    if (!cursorPos || !hoveredId || !cardRef.current || !containerRef.current) return
    const container = containerRef.current.getBoundingClientRect()
    const card = cardRef.current.getBoundingClientRect()
    const left = Math.min(Math.max(cursorPos.x + CARD_OFFSET, 8), container.width - card.width - 8)
    const top = Math.min(Math.max(cursorPos.y + CARD_OFFSET, 8), container.height - card.height - 8)
    setCardStyle({ left, top })
  }, [cursorPos, hoveredId])

  const metric = metrics.find((m) => m.key === statKey) ?? metrics[0]

  const { data, error, loading } = useFetch<WeeklyPlayerRow[]>(playersWeeklyPathForPosition(position))
  const teams = useFetch<TeamInfo[]>("/teams")

  const { up, down } = useMemo(
    () => (data ? trendingPlayers(data, metric, position) : { up: [], down: [] }),
    [data, metric, position],
  )

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
      color,
      teamColor: colorByTeam.get(line.team) ?? "var(--accent)",
      lastWeek: line.games[line.games.length - 1]?.week ?? 0,
    }))
  }, [up, down, colorByTeam])

  const weeks = useMemo(
    () => [...new Set(lineMetas.flatMap((m) => m.line.games.map((g) => g.week)))].sort((a, b) => a - b),
    [lineMetas],
  )

  // Wide format: one row per week, one column per shown player, so byes
  // break that player's line (via connectNulls={false}) instead of drawing a
  // straight line across a game they didn't play.
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

  function goToPlayer(line: TrendLine) {
    navigate(`/players/${line.id}`, { state: { playerName: line.name } })
  }

  const optionByLabel = new Map(metrics.map((m) => [m.label, m]))
  const hoveredMeta = lineMetas.find((m) => m.line.id === hoveredId)

  return (
    <Panel title="Trending Players">
      <div className="flex flex-nowrap items-center gap-3 overflow-x-auto border-b border-[var(--border)] px-4 py-3">
        <AxisSelect
          label="Stat"
          value={metric.label}
          options={metrics.map((m) => m.label)}
          onChange={(label) => setStatKey(optionByLabel.get(label)?.key ?? metrics[0].key)}
        />
      </div>
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load players: {error}</p>}
      {!loading && !error && lineMetas.length === 0 && (
        <p className="p-4 text-sm text-[var(--text-secondary)]">
          Not enough games yet to spot a trend in {metric.label.toLowerCase()}.
        </p>
      )}
      {lineMetas.length > 0 && (
        <div
          ref={containerRef}
          className="relative p-3"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredId(null)}
        >
          <ChartContainer config={chartConfig} className="aspect-[3/2]">
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
                tickFormatter={(value) => formatValue(Number(value), metric.unit)}
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
                  strokeWidth={hoveredId === meta.line.id ? 3 : 2}
                  strokeOpacity={hoveredId === null || hoveredId === meta.line.id ? 1 : DIMMED_OPACITY}
                  connectNulls={false}
                  isAnimationActive={false}
                  dot={false}
                  activeDot={false}
                  legendType="none"
                />
              ))}
              {/* Invisible wide-stroke lines on top of the visible ones - the
                  real hover/click target, so you don't need to land on the
                  thin 2-3px curve exactly. `name` carries the player id so
                  resolveHoveredId can read it straight off the DOM instead of
                  assuming curve order, which recharts doesn't preserve. */}
              {lineMetas.map((meta) => (
                <Line
                  key={`${meta.line.id}-hit`}
                  dataKey={meta.line.id}
                  name={meta.line.id}
                  stroke="transparent"
                  strokeWidth={HIT_STROKE_WIDTH}
                  connectNulls={false}
                  isAnimationActive={false}
                  className="cursor-pointer"
                  onClick={() => goToPlayer(meta.line)}
                  dot={makeDot(meta, () => goToPlayer(meta.line))}
                  activeDot={false}
                  legendType="none"
                />
              ))}
            </LineChart>
          </ChartContainer>
          {hoveredMeta && <LineHoverCard ref={cardRef} meta={hoveredMeta} unit={metric.unit} style={cardStyle} />}
          <p className="pt-2 text-xs text-[var(--text-muted)]">
            The {lineMetas.length} {position}s trending up (blue) or down (amber) the most in{" "}
            {metric.label.toLowerCase()} over their last {weeks.length} game
            {weeks.length === 1 ? "" : "s"}. Hover or click a line to see that player's numbers and
            go to their page.
          </p>
        </div>
      )}
    </Panel>
  )
}

export default TrendingPlayersChart
