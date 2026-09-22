// PlayerComparisonScatter.tsx
// Scatterplot comparing every player in the active position group across two
// user-selected metrics. Built on the Evil Charts chart/tooltip base (same
// foundation as the homepage's Team Efficiency chart).
import { useEffect, useMemo, useState } from "react"
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts"
import type { PositionGroup } from "../data/leaderCategories"
import {
  PLAYER_METRICS,
  playersPathForPosition,
  type PlayerMetric,
  type PlayerStatsRow,
} from "../data/playerMetrics"
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
  team: string
  headshot: string | null
  x: number
  y: number
}

function formatValue(value: number, unit?: string): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10
  return `${rounded.toLocaleString()}${unit ?? ""}`
}

const MARKER_SIZE = 22

// A player's headshot clipped to a circle, with a surface-color ring so it
// stays legible where points overlap - real photos don't need the light
// badge team logos do, since they're not flat marks that can vanish on a
// dark background. Falls back to a plain dot for the rare missing photo.
// The transparent hit circle keeps the hover/focus target >=24px even
// though the visible mark itself is about that size.
function PlayerHeadshotDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: PlayerPoint }) {
  if (cx === undefined || cy === undefined || !payload) return null
  const radius = MARKER_SIZE / 2

  if (!payload.headshot) {
    return (
      <g className="cursor-pointer">
        <circle cx={cx} cy={cy} r={12} fill="transparent" />
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill="var(--accent)"
          fillOpacity={0.85}
          stroke="var(--surface-1)"
          strokeWidth={2}
        />
      </g>
    )
  }

  const clipId = `headshot-clip-${payload.id}`
  return (
    <g className="origin-center cursor-pointer transition-transform duration-150 [transform-box:fill-box] hover:scale-125 hover:[filter:drop-shadow(0_0_6px_rgba(238,242,251,0.45))]">
      <circle cx={cx} cy={cy} r={16} fill="transparent" />
      <circle cx={cx} cy={cy} r={radius + 1.5} fill="var(--text-primary)" fillOpacity={0.92} />
      <clipPath id={clipId}>
        <circle cx={cx} cy={cy} r={radius} />
      </clipPath>
      <image
        href={payload.headshot}
        x={cx - radius}
        y={cy - radius}
        width={MARKER_SIZE}
        height={MARKER_SIZE}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clipId})`}
      />
    </g>
  )
}

function TooltipHeader({ point }: { point?: PlayerPoint }) {
  if (!point) return null
  return (
    <div className="flex items-center gap-2">
      {point.headshot && (
        <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[var(--text-primary)]/90">
          <img src={point.headshot} alt="" className="h-full w-full object-cover" />
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

  const points = useMemo<PlayerPoint[] | null>(
    () =>
      data?.map((row) => ({
        id: row.player_id,
        name: row.player_display_name,
        team: row.recent_team,
        headshot: row.headshot_url,
        x: xMetric.value(row),
        y: yMetric.value(row),
      })) ?? null,
    [data, xMetric, yMetric],
  )

  const optionByLabel = new Map(metrics.map((metric) => [metric.label, metric]))

  return (
    <Panel title="Compare Players" expandable>
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
          <ChartContainer config={chartConfig} className="aspect-square">
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
              <Scatter data={points} shape={<PlayerHeadshotDot />} />
            </ScatterChart>
          </ChartContainer>
        </div>
      )}
    </Panel>
  )
}

export default PlayerComparisonScatter
