// PlayerRadarChart.tsx
// Radar of 6 position-specific efficiency stats, each plotted as a
// percentile rank against other qualifying players at the same position
// this season - not raw units, since EPA/play, yards/attempt, and rate
// stats don't share a scale. Hovering a vertex shows the underlying raw
// value and rank.
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"
import { ordinal } from "../data/efficiency"
import { useFetch } from "../lib/useFetch"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import { ChartTooltip } from "./evilcharts/ui/recharts-tooltip"
import Panel from "./Panel"

interface RadarAxis {
  key: string
  label: string
  value: number | null
  percentile: number | null
}

interface PlayerRadar {
  player_id: string
  position: string
  axes: RadarAxis[]
}

const chartConfig = {
  percentile: { label: "Percentile" },
} satisfies ChartConfig

function AxisTooltip({ active, payload }: { active?: boolean; payload?: { payload: RadarAxis }[] }) {
  // An empty-but-present element, not null - keeps the tooltip from
  // resetting position to (0,0) and flying in from the corner on each hover.
  if (!active || !payload?.length) return <span className="p-4" />
  const axis = payload[0].payload
  return (
    <div className="grid min-w-36 gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/70 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm">
      <div className="font-medium text-[var(--text-primary)]">{axis.label}</div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[var(--text-secondary)]">Value</span>
        <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
          {axis.value ?? "—"}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[var(--text-secondary)]">Percentile</span>
        <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
          {axis.percentile !== null ? ordinal(Math.round(axis.percentile)) : "—"}
        </span>
      </div>
    </div>
  )
}

function PlayerRadarChart({ playerId, teamColor }: { playerId: string; teamColor: string }) {
  const { data, error, loading } = useFetch<PlayerRadar>(`/players/${playerId}/radar`)

  return (
    <Panel title="Player Breakdown">
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load radar: {error}</p>}
      {data && (
        <div className="p-3">
          <ChartContainer config={chartConfig} className="aspect-[4/3]">
            <RadarChart data={data.axes.map((axis) => ({ ...axis, reference: 50 }))}>
              <defs>
                {/* Brighter near the center, fading toward the points - a
                    soft glow rather than a flat fill. */}
                <radialGradient id="radarFill" cx="50%" cy="50%" r="70%">
                  <stop offset="0%" stopColor={teamColor} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={teamColor} stopOpacity={0.08} />
                </radialGradient>
              </defs>
              <PolarGrid stroke="var(--border)" radialLines={false} />
              <PolarAngleAxis dataKey="label" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={5} />
              <ChartTooltip content={<AxisTooltip />} cursor={false} />
              <Radar
                dataKey="percentile"
                stroke={teamColor}
                strokeWidth={2}
                fill="url(#radarFill)"
                dot={{ r: 4, fill: "var(--surface-1)", stroke: teamColor, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: teamColor, stroke: "var(--surface-1)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
              {/* A constant-50 reference series, not a styled grid ring -
                  PolarGrid's own ring-highlighting options didn't position
                  correctly, but Radar plots against the same domain-aware
                  scale the real percentile series already uses correctly. */}
              <Radar
                dataKey="reference"
                stroke="var(--accent)"
                strokeDasharray="4 3"
                fill="none"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                legendType="none"
              />
            </RadarChart>
          </ChartContainer>
          <p className="px-3 pb-1 text-xs text-[var(--text-muted)]">
            Each axis is this player's percentile rank at their position this season; the dashed
            ring marks the 50th percentile, or league average.
          </p>
        </div>
      )}
    </Panel>
  )
}

export default PlayerRadarChart
