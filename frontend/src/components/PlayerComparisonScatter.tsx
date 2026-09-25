// PlayerComparisonScatter.tsx
// Scatterplot comparing every player in the active position group across two
// user-selected metrics. Built on the Evil Charts chart/tooltip base (same
// foundation as the homepage's Team Efficiency chart). Markers are player
// headshots in a team-colored ring (initials when there's no photo). An
// earlier headshot version was slow because it drew ~170 full-size (~630 KB,
// 3400px) photos, each with its own clipPath; these are 128px, pre-cropped
// round by the CDN (~7 KB each), so there's nothing to clip.
import { memo, useEffect, useMemo, useState } from "react"
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis } from "recharts"
import { useNavigate } from "react-router-dom"
import type { PositionGroup } from "../data/leaderCategories"
import {
  metricMedian,
  PLAYER_METRICS,
  playersPathForPosition,
  type PlayerMetric,
  type PlayerStatsRow,
} from "../data/playerMetrics"
import type { TeamInfo } from "../data/teams"
import { headshotUrl } from "../lib/imageUrls"
import { initialsFor, readableTextColor } from "../lib/playerVisuals"
import { useFetch } from "../lib/useFetch"
import AxisSelect from "./AxisSelect"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import { ChartTooltip, ChartTooltipContent } from "./evilcharts/ui/recharts-tooltip"
import Panel from "./Panel"
import PlayerAvatar from "./PlayerAvatar"

const chartConfig = {
  player: { label: "Player" },
} satisfies ChartConfig

interface PlayerPoint {
  id: string
  name: string
  initials: string
  team: string
  color: string
  headshot: string | null
  x: number // xMetric's raw value
  y: number // yMetric's raw value
}

function formatValue(value: number, unit?: string): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10
  return `${rounded.toLocaleString()}${unit ?? ""}`
}

// "+120" / "−45" / "0" - for the tooltip's "how far from the median player"
// note, in the metric's own unit rather than a statistical score.
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

const MARKER_RADIUS = 11
// Team-color ring width around a headshot.
const RING = 2
// ~6x the photo's on-screen size, the ratio that looked sharp for leader avatars.
const MARKER_PHOTO_PX = 128

// A team-colored dot showing the player's headshot (or initials, with no
// photo), with a surface-color ring so it stays legible where points overlap.
// The transparent hit circle keeps the hover/focus target >=24px even though
// the visible mark is smaller.
// Memoized so hovering one marker doesn't force the other ~170 to re-render.
const PlayerDot = memo(function PlayerDot({
  cx,
  cy,
  payload,
  onSelect,
}: {
  cx?: number
  cy?: number
  payload?: PlayerPoint
  onSelect?: (point: PlayerPoint) => void
}) {
  if (cx === undefined || cy === undefined || !payload) return null

  return (
    <g
      onClick={() => onSelect?.(payload)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect?.(payload)
      }}
      aria-label={`View ${payload.name}'s player page`}
      className="origin-center cursor-pointer transition-transform duration-150 [transform-box:fill-box] hover:scale-125"
    >
      <circle cx={cx} cy={cy} r={16} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={MARKER_RADIUS}
        fill={payload.color}
        stroke="var(--surface-1)"
        strokeWidth={2}
      />
      {payload.headshot ? (
        <image
          href={headshotUrl(payload.headshot, MARKER_PHOTO_PX, true)}
          x={cx - MARKER_RADIUS + RING}
          y={cy - MARKER_RADIUS + RING}
          width={(MARKER_RADIUS - RING) * 2}
          height={(MARKER_RADIUS - RING) * 2}
        />
      ) : (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fontWeight={700}
          fill={readableTextColor(payload.color)}
        >
          {payload.initials}
        </text>
      )}
    </g>
  )
})

// Tooltip header: a bigger (non-round, 192px) headshot beside the name and team.
function TooltipHeader({ point }: { point?: PlayerPoint }) {
  if (!point) return null
  return (
    <div className="flex items-center gap-2">
      <PlayerAvatar name={point.name} headshot={point.headshot} color={point.color} size="h-9 w-9" />
      <div>
        <div className="text-sm text-[var(--text-primary)]">{point.name}</div>
        <div className="text-[10px] font-normal tracking-wider text-[var(--text-muted)] uppercase">
          {point.team}
        </div>
      </div>
    </div>
  )
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

function PlayerComparisonScatter({ position }: { position: PositionGroup }) {
  const navigate = useNavigate()
  const metrics = PLAYER_METRICS[position]
  const [xKey, setXKey] = useState(metrics[0].key)
  const [yKey, setYKey] = useState(metrics[1]?.key ?? metrics[0].key)

  // Reset to sensible defaults when the position (and so the metric list)
  // changes, rather than keeping a stale metric from a different position.
  useEffect(() => {
    setXKey(metrics[0].key)
    setYKey(metrics[1]?.key ?? metrics[0].key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position])

  const xMetric = metrics.find((metric) => metric.key === xKey) ?? metrics[0]
  const yMetric = metrics.find((metric) => metric.key === yKey) ?? metrics[0]

  const { data, error, loading } = useFetch<PlayerStatsRow[]>(playersPathForPosition(position))
  const teams = useFetch<TeamInfo[]>("/teams")

  // The quadrant lines sit at the median, but each axis plots the real stat -
  // ticks, dot positions, and the tooltip's headline number are all in the
  // metric's own unit; only the tooltip's small "vs. median" note is a offset.
  const xMedian = useMemo(() => (data ? metricMedian(data, xMetric) : 0), [data, xMetric])
  const yMedian = useMemo(() => (data ? metricMedian(data, yMetric) : 0), [data, yMetric])

  const points = useMemo<PlayerPoint[] | null>(() => {
    if (!data) return null
    const colorByTeam = new Map(teams.data?.map((team) => [team.team_abbr, team.team_color]))
    return data.map((row) => ({
      id: row.player_id,
      name: row.player_display_name,
      initials: initialsFor(row.player_display_name),
      team: row.recent_team,
      color: colorByTeam.get(row.recent_team) ?? "var(--accent)",
      headshot: row.headshot_url,
      x: xMetric.value(row),
      y: yMetric.value(row),
    }))
  }, [data, teams.data, xMetric, yMetric])

  const xDomain = useMemo(() => valueDomain(points?.map((p) => p.x) ?? []), [points])
  const yDomain = useMemo(() => valueDomain(points?.map((p) => p.y) ?? []), [points])

  const optionByLabel = new Map(metrics.map((metric) => [metric.label, metric]))

  function goToPlayer(point: PlayerPoint) {
    navigate(`/players/${point.id}`, { state: { playerName: point.name } })
  }

  return (
    <Panel title="Compare Players">
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
        <p className="p-4 text-sm text-[var(--negative)]">Couldn't load players: {error}</p>
      )}
      {points && points.length === 0 && (
        <p className="p-4 text-sm text-[var(--text-secondary)]">No {position}s with stats yet.</p>
      )}
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
                    labelFormatter={(_, items) => (
                      <TooltipHeader point={items[0]?.payload as PlayerPoint | undefined} />
                    )}
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
              <Scatter
                data={points}
                shape={(props: { cx?: number; cy?: number; payload?: PlayerPoint }) => (
                  <PlayerDot {...props} onSelect={goToPlayer} />
                )}
                isAnimationActive={false}
              />
            </ScatterChart>
          </ChartContainer>
          <p className="pt-2 text-xs text-[var(--text-muted)]">
            Each dot is a {position}, positioned by the two stats you pick above. The lighter lines
            mark the median {position} in each stat, splitting the chart into four quadrants - so a
            player above both lines is beating the middle of the pack on both stats at once.
          </p>
        </div>
      )}
    </Panel>
  )
}

export default PlayerComparisonScatter
