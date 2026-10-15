// LeagueBeeswarm.tsx
// "League Comparison": one swarm column per radar axis, a dot per qualifying player at a position (or per team), placed by percentile. A click, tap, or search highlights one player/team in every column; clicking them again opens their page.
// The optional focus (the page's own player or team) is always drawn in team
// color. A mouse's hover and clicks, and a finger's taps, go to the nearest dot
// within reach (see chartMarks). On a phone the chart scrolls sideways (with
// two-line column labels), and on a touchscreen a tap shows its dot's numbers
// below the chart instead of a hover card.
import { memo, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Scatter, ScatterChart, XAxis, YAxis } from "recharts"
import { ordinal } from "../data/efficiency"
import { teamPath, type TeamInfo } from "../data/teams"
import { activateOnKey } from "../lib/activateOnKey"
import { nearestMarkAt, useHoveredMark } from "../lib/chartMarks"
import { swarmCell } from "../lib/chartSummaries"
import { useFetch } from "../lib/useFetch"
import { PHONE_QUERY, TOUCH_QUERY, useMediaQuery } from "../lib/useMediaQuery"
import { useTapToOpen } from "../lib/useTapToOpen"
import ChartDataTable from "./ChartDataTable"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import HighlightPicker from "./HighlightPicker"
import Panel from "./Panel"
import RadarAxisTick from "./RadarAxisTick"
import { HoverCard, OpenButton, TapDetails } from "./TapDetails"

interface PoolAxis {
  key: string
  value: number | null
  percentile: number | null
}

interface PlayerRadarPool {
  position: string
  axes: { key: string; label: string }[]
  players: { player_id: string; name: string; team: string; axes: PoolAxis[] }[]
}

interface TeamRadarPool {
  axes: { key: string; label: string }[]
  teams: { team: string; axes: PoolAxis[] }[]
}

// A player or a team, whichever the chart is plotting.
export interface SwarmRow {
  id: string
  name: string
  // Team abbreviation: the dot color, and shown after a player's name.
  team: string
  axes: PoolAxis[]
}

export interface SwarmPoint {
  row: SwarmRow
  axisIndex: number
  axisLabel: string
  value: number | null
  x: number // axisIndex + horizontal jitter
  y: number // percentile, 0-100
}

const chartConfig = {
  percentile: { label: "Percentile" },
} satisfies ChartConfig

// Axes sourced from NFL Next Gen Stats rather than play-by-play - see the
// matching note in PlayerRadarChart.tsx.
const NGS_AXES = new Set(["avg_separation", "rush_yards_over_expected"])

// Adaptive clustering, not fixed bins: walk rows in percentile order and
// start a new cluster whenever the gap to the next one exceeds the
// threshold, then jitter each cluster's dots alternating left/right of the
// column's center. Looser gaps produce tighter, more legible clusters than
// rigid bins would for an uneven real-world percentile distribution.
const CLUSTER_GAP = 2.5
const JITTER_STEP = 0.07
const MAX_JITTER = 0.42

function layoutColumn(rows: SwarmRow[], axisIndex: number, axisKey: string, axisLabel: string): SwarmPoint[] {
  const withPct = rows
    .flatMap((row) => {
      const axis = row.axes.find((a) => a.key === axisKey)
      return axis?.percentile != null ? [{ row, pct: axis.percentile, value: axis.value }] : []
    })
    .sort((a, b) => a.pct - b.pct)

  const points: SwarmPoint[] = []
  let cluster: typeof withPct = []
  let clusterStart = -Infinity

  function flush() {
    cluster.forEach((entry, i) => {
      const rank = Math.ceil(i / 2)
      const sign = i % 2 === 0 ? 1 : -1
      const jitter = i === 0 ? 0 : Math.min(rank * JITTER_STEP, MAX_JITTER) * sign
      points.push({ row: entry.row, axisIndex, axisLabel, value: entry.value, x: axisIndex + jitter, y: entry.pct })
    })
    cluster = []
  }

  for (const entry of withPct) {
    if (entry.pct - clusterStart > CLUSTER_GAP) {
      flush()
      clusterStart = entry.pct
    }
    cluster.push(entry)
  }
  flush()

  return points
}

type DotRole = "focus" | "highlighted" | "faded" | "plain"
// SVG draws later marks on top: the focus and highlighted rows go last.
const DRAW_ORDER: Record<DotRole, number> = { plain: 0, faded: 0, focus: 1, highlighted: 2 }

const SwarmDot = memo(function SwarmDot({
  cx,
  cy,
  payload,
  role,
  hovered,
  color,
  tapKey,
  actionLabel,
  onActivate,
}: {
  cx?: number
  cy?: number
  payload?: SwarmPoint
  role: DotRole
  // Nearest the mouse: gets a neutral ring, so it's clear which dot the hover card describes.
  hovered: boolean
  color: string
  // Clicks and taps are resolved by the chart's wrapper from this key (see
  // chartMarks); `onActivate` here is keyboard activation.
  tapKey: string
  actionLabel: string
  onActivate: () => void
}) {
  if (cx === undefined || cy === undefined || !payload) return null
  const big = role === "focus" || role === "highlighted"
  const radius = big ? 6 : 3.5

  return (
    <g
      data-tap-key={tapKey}
      role="button"
      tabIndex={0}
      onKeyDown={activateOnKey(onActivate)}
      aria-label={actionLabel}
      className="cursor-pointer"
    >
      <circle cx={cx} cy={cy} r={10} fill="transparent" />
      {(role === "highlighted" || hovered) && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 3.5}
          fill="none"
          stroke={role === "highlighted" ? "var(--accent)" : "var(--text-secondary)"}
          strokeWidth={role === "highlighted" ? 2 : 1.5}
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={big ? color : "var(--text-muted)"}
        fillOpacity={big ? 1 : role === "faded" ? 0.2 : 0.55}
        stroke={big ? "var(--surface-1)" : "none"}
        strokeWidth={big ? 2 : 0}
      />
    </g>
  )
})

// A dot's name, stat, value, and percentile: the hover card's content, and the touchscreen box's.
export function SwarmRows({ point, showTeam }: { point: SwarmPoint; showTeam: boolean }) {
  return (
    <div className="grid gap-1">
      <div className="font-medium text-[var(--text-primary)]">
        {point.row.name}
        {showTeam && <span className="text-[var(--text-muted)]"> · {point.row.team}</span>}
      </div>
      <div className="text-[var(--text-secondary)]">{point.axisLabel}</div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[var(--text-secondary)]">Value</span>
        <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">{point.value ?? "—"}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[var(--text-secondary)]">Percentile</span>
        <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
          {ordinal(Math.round(point.y))}
        </span>
      </div>
    </div>
  )
}

// A dot per (stat column, row).
const dotKey = (point: SwarmPoint) => `${point.axisIndex}:${point.row.id}`
const idOfKey = (key: string) => key.slice(key.indexOf(":") + 1)

type LeagueBeeswarmProps =
  // Every qualifying player at `position`; focusId is the player page's own player.
  | { kind: "players"; position: string; focusId?: string }
  // Every team; focusId is the team page's own team.
  | { kind: "teams"; focusId?: string }

function LeagueBeeswarm(props: LeagueBeeswarmProps) {
  const { kind, focusId } = props
  const navigate = useNavigate()
  const players = kind === "players"
  // Same paths as the radar charts, so useFetch's cache serves both from one request.
  const playerPool = useFetch<PlayerRadarPool>(
    players ? `/players/radar-pool?position=${encodeURIComponent(props.position)}` : null,
  )
  const teamPool = useFetch<TeamRadarPool>(players ? null : "/teams/radar-pool")
  // Team colors for the dots, and team names for the team chart.
  const teams = useFetch<TeamInfo[]>("/teams")
  const pool = players ? playerPool : teamPool

  const colorByTeam = useMemo(() => new Map(teams.data?.map((team) => [team.team_abbr, team.team_color])), [teams.data])
  const chart = useMemo(() => {
    if (players && playerPool.data) {
      const rows = playerPool.data.players.map((p) => ({ id: p.player_id, name: p.name, team: p.team, axes: p.axes }))
      return { axes: playerPool.data.axes, rows, group: playerPool.data.position }
    }
    if (!players && teamPool.data && teams.data) {
      const nameByTeam = new Map(teams.data.map((team) => [team.team_abbr, team.team_name]))
      const rows = teamPool.data.teams.map((t) => ({ id: t.team, name: nameByTeam.get(t.team) ?? t.team, team: t.team, axes: t.axes }))
      return { axes: teamPool.data.axes, rows, group: null }
    }
    return null
  }, [players, playerPool.data, teamPool.data, teams.data])

  const points = useMemo(
    () => chart?.axes.flatMap((axis, index) => layoutColumn(chart.rows, index, axis.key, axis.label)) ?? null,
    [chart],
  )
  const pointByKey = useMemo(() => new Map(points?.map((point) => [dotKey(point), point])), [points])

  const loading = pool.loading || teams.loading
  const error = pool.error ?? teams.error
  // A player missing from the pool hasn't hit the minimum season volume for a
  // radar profile - expected for a backup, not an error, and there's no dot to mark.
  const notEnoughVolume = !!chart && !!focusId && !chart.rows.some((row) => row.id === focusId)
  const focusName = chart?.rows.find((row) => row.id === focusId)?.name
  const noun = players ? "player" : "team"

  function openRow(id: string) {
    navigate(players ? `/players/${id}` : teamPath(id))
  }

  const touchScreen = useMediaQuery(TOUCH_QUERY)
  const phone = useMediaQuery(PHONE_QUERY)
  // First click or tap highlights a row; a second one on it opens its page
  // (except the focus row: that's the page already open).
  const tap = useTapToOpen<string>(
    (key) => {
      if (idOfKey(key) !== focusId) openRow(idOfKey(key))
    },
    { selectFirst: true },
  )
  const highlightedId = tap.selected === null ? null : idOfKey(tap.selected)
  const highlightedRow = chart?.rows.find((row) => row.id === highlightedId)
  const selectedPoint = tap.selected === null ? undefined : pointByKey.get(tap.selected)
  const hover = useHoveredMark()
  const hoveredPoint = hover.hovered && pointByKey.get(hover.hovered.key)
  // A press on any of the highlighted row's dots counts as "the same mark"
  // (the hook compares keys), so a second click in another column opens it too.
  const sameRow = (key: string | null) =>
    key !== null && highlightedId !== null && idOfKey(key) === highlightedId ? tap.selected : key

  function roleOf(point: SwarmPoint): DotRole {
    if (point.row.id === highlightedId) return "highlighted"
    if (point.row.id === focusId) return "focus"
    return highlightedId === null ? "plain" : "faded"
  }
  const drawn = points ? [...points].sort((a, b) => DRAW_ORDER[roleOf(a)] - DRAW_ORDER[roleOf(b)]) : null

  const searchLabel = (row: SwarmRow) => (players ? `${row.name} · ${row.team}` : row.name)
  const ngsAxisLabels = players ? (chart?.axes.filter((axis) => NGS_AXES.has(axis.key)).map((axis) => axis.label) ?? []) : []
  const who = players ? `Every qualifying ${chart?.group} this season (${chart?.rows.length})` : `All ${chart?.rows.length} teams this season`

  return (
    <Panel title="League Comparison">
      {chart && !notEnoughVolume && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <HighlightPicker
            noun={`${noun}s`}
            options={chart.rows.map((row) => ({ id: row.id, label: searchLabel(row) }))}
            picked={highlightedRow ? { id: highlightedRow.id, label: searchLabel(highlightedRow) } : null}
            onPick={(id) => {
              // Selects the row's first dot, which the touchscreen box then describes.
              const point = points?.find((p) => p.row.id === id)
              tap.select(point ? dotKey(point) : null)
            }}
            onClear={() => tap.select(null)}
          />
        </div>
      )}
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {notEnoughVolume && (
        <p className="p-4 text-sm text-[var(--text-secondary)]">Not enough season volume yet for a league comparison.</p>
      )}
      {error && !notEnoughVolume && (
        <p className="p-4 text-sm text-[var(--negative)]">Couldn't load league comparison: {error}</p>
      )}
      {chart && drawn && !notEnoughVolume && (
        <div className="p-3">
          {/* On a phone six columns don't fit with readable labels, so the
              chart keeps a minimum width and scrolls sideways (a swipe is a
              pointercancel, never a tap). */}
          <div
            data-chart-marks
            className={`relative ${phone ? "overflow-x-auto" : ""} ${hover.hovered ? "cursor-pointer" : ""}`}
            {...tap.pressHandlers((x, y) => sameRow(nearestMarkAt(x, y)))}
            {...hover.hoverHandlers}
          >
            <ChartContainer
              config={chartConfig}
              className={`aspect-auto h-[420px] ${phone ? "min-w-[620px]" : ""}`}
              label={`${who}, placed by percentile rank on each of ${chart.axes.length} stats${
                focusName ? `, with ${focusName} in team color` : ""
              }.${highlightedRow ? ` Highlighted: ${highlightedRow.name}.` : ""}`}
            >
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[-0.5, chart.axes.length - 0.5]}
                  ticks={chart.axes.map((_, i) => i)}
                  tickFormatter={(i: number) => chart.axes[i]?.label ?? ""}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  // Two centered lines on a phone (see RadarAxisTick); one on wider screens.
                  tick={
                    phone
                      ? (tick: { x?: number | string; y?: number | string; payload?: { value: unknown } }) => (
                          <RadarAxisTick
                            x={Number(tick.x)}
                            y={Number(tick.y)}
                            textAnchor="middle"
                            verticalAnchor="start"
                            payload={{ value: chart.axes[Number(tick.payload?.value)]?.label ?? "" }}
                          />
                        )
                      : { fill: "var(--text-secondary)", fontSize: 11 }
                  }
                  height={phone ? 40 : undefined}
                  interval={0}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                  width={32}
                />
                <Scatter
                  data={drawn}
                  shape={(dot: { cx?: number; cy?: number; payload?: SwarmPoint }) => {
                    if (!dot.payload) return <g />
                    const key = dotKey(dot.payload)
                    const role = roleOf(dot.payload)
                    const name = dot.payload.row.name
                    return (
                      <SwarmDot
                        {...dot}
                        role={role}
                        hovered={key === hover.hovered?.key}
                        color={colorByTeam.get(dot.payload.row.team) ?? "var(--accent)"}
                        tapKey={key}
                        actionLabel={
                          role === "highlighted" && dot.payload.row.id !== focusId
                            ? `View ${name}'s ${noun} page`
                            : `Highlight ${name}`
                        }
                        onActivate={() => tap.tap(sameRow(key))}
                      />
                    )
                  }}
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ChartContainer>
            {!touchScreen && hover.hovered && hoveredPoint && (
              <HoverCard mark={hover.hovered}>
                <SwarmRows point={hoveredPoint} showTeam={players} />
              </HoverCard>
            )}
          </div>
          {touchScreen && (
            // The filled box's height (134px), so a tap doesn't shift the caption.
            <TapDetails prompt={`Tap a dot to see that ${noun}'s numbers.`} className="min-h-34">
              {selectedPoint && (
                <div className="flex flex-col gap-1.5">
                  <SwarmRows point={selectedPoint} showTeam={players} />
                  {selectedPoint.row.id !== focusId && (
                    <OpenButton name={selectedPoint.row.name} onClick={() => openRow(selectedPoint.row.id)} />
                  )}
                </div>
              )}
            </TapDetails>
          )}
          <p className="px-3 pt-2 pb-1 text-xs text-[var(--text-muted)]">
            {players ? "Every qualifying player at the position" : "Every team in the league"} this season, positioned
            by percentile rank on each axis. {touchScreen ? "Tap" : "Click"} a dot to highlight that {noun} in every
            column, then again to open {players ? "their" : "its"} page.
            {phone && ` Swipe the chart sideways to see all ${chart.axes.length} stats.`}
            {ngsAxisLabels.length > 0 &&
              ` ${ngsAxisLabels.join(" and ")} ${ngsAxisLabels.length > 1 ? "are" : "is"} sourced from NFL Next Gen Stats, which can take time to update or require higher minimum touches to appear, so ${ngsAxisLabels.length > 1 ? "those columns" : "that column"} may have fewer dots.`}
          </p>
          <ChartDataTable
            caption={players ? `Every qualifying ${chart.group}'s stats with percentile ranks` : "Every team's stats with percentile ranks"}
            columns={[players ? "Player" : "Team", ...(players ? ["Team"] : []), ...chart.axes.map((axis) => axis.label)]}
            rows={chart.rows.map((row) => [row.name, ...(players ? [row.team] : []), ...row.axes.map(swarmCell)])}
          />
        </div>
      )}
    </Panel>
  )
}

export default LeagueBeeswarm
