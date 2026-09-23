// PlayerComparisonScatter.tsx
// Scatterplot comparing every player in the active position group across two
// user-selected metrics. Built on the Evil Charts chart/tooltip base (same
// foundation as the homepage's Team Efficiency chart). Markers are team-
// colored dots with the player's initials - real headshots were tried first,
// but clipping ~170 photos per position was the actual performance
// bottleneck (confirmed by disabling them), so this trades the photo for
// something just as identifying at a fraction of the render cost.
import { memo, useEffect, useMemo, useState } from "react"
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts"
import { useNavigate } from "react-router-dom"
import type { PositionGroup } from "../data/leaderCategories"
import {
  PLAYER_METRICS,
  playersPathForPosition,
  type PlayerMetric,
  type PlayerStatsRow,
} from "../data/playerMetrics"
import type { TeamInfo } from "../data/teams"
import { initialsFor, readableTextColor } from "../lib/playerVisuals"
import { useFetch } from "../lib/useFetch"
import AxisSelect from "./AxisSelect"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import { ChartTooltip, ChartTooltipContent } from "./evilcharts/ui/recharts-tooltip"
import Panel from "./Panel"

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
  x: number
  y: number
}

function formatValue(value: number, unit?: string): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10
  return `${rounded.toLocaleString()}${unit ?? ""}`
}

const MARKER_RADIUS = 11

// A team-colored dot with the player's initials, with a surface-color ring
// so it stays legible where points overlap. The transparent hit circle keeps
// the hover/focus target >=24px even though the visible mark is smaller.
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
    </g>
  )
})

// The scatter markers themselves stay initials-only (rendering ~170 headshot
// images at once was the actual perf bottleneck), but the tooltip only ever
// shows one player at a time, so the photo is effectively free here.
function TooltipHeader({ point }: { point?: PlayerPoint }) {
  if (!point) return null
  return (
    <div className="flex items-center gap-2">
      {point.headshot ? (
        <img
          src={point.headshot}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover"
          style={{ backgroundColor: point.color }}
        />
      ) : (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ backgroundColor: point.color, color: readableTextColor(point.color) }}
        >
          {point.initials}
        </span>
      )}
      <div>
        <div className="text-sm text-[var(--text-primary)]">{point.name}</div>
        <div className="text-[10px] font-normal tracking-wider text-[var(--text-muted)] uppercase">
          {point.team}
        </div>
      </div>
    </div>
  )
}

function TooltipRow({ name, value, unit }: { name: string; value: number; unit?: string }) {
  return (
    <div className="flex w-full items-baseline justify-between gap-4">
      <span className="text-[var(--text-secondary)]">{name}</span>
      <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
        {formatValue(value, unit)}
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
                tickFormatter={(value) => formatValue(Number(value), xMetric.unit)}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                label={{
                  value: xMetric.label,
                  position: "insideBottom",
                  offset: -14,
                  fill: "var(--text-secondary)",
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={yMetric.label}
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
                }}
              />
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
                      return (
                        <TooltipRow name={String(name)} value={Number(value)} unit={metric?.unit} />
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
        </div>
      )}
    </Panel>
  )
}

export default PlayerComparisonScatter
