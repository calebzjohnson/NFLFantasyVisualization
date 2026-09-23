// TeamEfficiencyScatter.tsx
// Offense vs defense EPA-per-play scatter: one team logo per point, with
// league-average lines and quadrant labels. Built on the Evil Charts chart and
// tooltip base.
import { useMemo } from "react"
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  formatEpa,
  leagueAverages,
  ordinal,
  toTeamPoints,
  type TeamEfficiency,
  type TeamPoint,
} from "../data/efficiency"
import type { TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import { ChartTooltip, ChartTooltipContent } from "./evilcharts/ui/recharts-tooltip"
import Panel from "./Panel"

const chartConfig = {
  offense: { label: "Offense EPA/play" },
  defense: { label: "Defense EPA/play allowed" },
} satisfies ChartConfig

// Each logo sits on a fixed light badge (not a theme token) - NFL logos are
// drawn assuming a light background, so the badge has to stay light no matter
// what the page theme is. The 2px ring in the panel's surface color separates
// overlapping badges, and the badge (30px+) is the hover target, well above
// the 24px minimum.
const BADGE_RADIUS = 15
const LOGO_SIZE = 22
const BADGE_FILL = "#f2f2f0"

function paddedDomain(values: number[]): [number, number] {
  const pad = 0.06
  return [
    Math.floor((Math.min(...values) - pad) * 10) / 10,
    Math.ceil((Math.max(...values) + pad) * 10) / 10,
  ]
}

function tickRange([min, max]: [number, number]): number[] {
  const ticks: number[] = []
  for (let tenths = Math.round(min * 10); tenths <= Math.round(max * 10); tenths++) {
    ticks.push(tenths / 10)
  }
  return ticks
}

function formatTick(value: number): string {
  if (value === 0) return "0"
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`
}

function LogoBadge({ logo, size }: { logo: string; size: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${size}`}
      style={{ backgroundColor: BADGE_FILL }}
    >
      <img src={logo} alt="" className="h-[75%] w-[75%] object-contain" />
    </span>
  )
}

interface MarkerProps {
  cx?: number
  cy?: number
  payload?: TeamPoint
}

function TeamLogoMarker({ cx, cy, payload }: MarkerProps) {
  if (cx === undefined || cy === undefined || !payload) return null
  return (
    <g className="origin-center cursor-pointer transition-transform duration-150 [transform-box:fill-box] hover:scale-125 hover:[filter:drop-shadow(0_0_6px_rgba(37,106,191,0.45))]">
      <circle
        cx={cx}
        cy={cy}
        r={BADGE_RADIUS}
        fill={BADGE_FILL}
        stroke="var(--surface-1)"
        strokeWidth={2}
      />
      <image
        href={payload.logo}
        x={cx - LOGO_SIZE / 2}
        y={cy - LOGO_SIZE / 2}
        width={LOGO_SIZE}
        height={LOGO_SIZE}
      />
    </g>
  )
}

function TooltipHeader({ point }: { point?: TeamPoint }) {
  if (!point) return null
  return (
    <div className="flex items-center gap-2">
      <LogoBadge logo={point.logo} size="h-7 w-7" />
      <div>
        <div className="text-sm text-[var(--text-primary)]">{point.name}</div>
        <div className="text-[10px] font-normal tracking-wider text-[var(--text-muted)] uppercase">
          Offense {ordinal(point.offenseRank)} · Defense {ordinal(point.defenseRank)}
        </div>
      </div>
    </div>
  )
}

function TooltipRow({ name, value }: { name: string; value: number }) {
  return (
    <div className="flex w-full items-baseline justify-between gap-4">
      <span className="text-[var(--text-secondary)]">{name}</span>
      <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
        {formatEpa(value)}
      </span>
    </div>
  )
}

const QUADRANT_LABEL = { fill: "var(--text-muted)", fontSize: 10, letterSpacing: 2 } as const

function EfficiencyChart({ points }: { points: TeamPoint[] }) {
  const average = leagueAverages(points)
  const xDomain = paddedDomain(points.map((p) => p.offense))
  const yDomain = paddedDomain(points.map((p) => p.defense))
  const [xMin, xMax] = xDomain
  const [yMin, yMax] = yDomain

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <ChartContainer
        config={chartConfig}
        className="aspect-auto"
        role="img"
        aria-label="Scatter plot of each team's offensive versus defensive EPA per play."
      >
        <ScatterChart margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis
            type="number"
            dataKey="offense"
            name="Offense EPA/play"
            domain={xDomain}
            ticks={tickRange(xDomain)}
            tickFormatter={formatTick}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            height={46}
            label={{
              value: "Offense EPA / play",
              position: "insideBottom",
              offset: 0,
              fill: "var(--text-secondary)",
              fontSize: 11,
              fontWeight: 700,
            }}
          />
          <YAxis
            type="number"
            dataKey="defense"
            name="Defense EPA/play allowed"
            domain={yDomain}
            ticks={tickRange(yDomain)}
            tickFormatter={formatTick}
            reversed
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            width={54}
            label={{
              value: "Defense EPA / play allowed",
              angle: -90,
              position: "insideLeft",
              offset: 4,
              style: { textAnchor: "middle" },
              fill: "var(--text-secondary)",
              fontSize: 11,
              fontWeight: 700,
            }}
          />
          <ReferenceArea
            x1={average.offense}
            x2={xMax}
            y1={yMin}
            y2={average.defense}
            fill="transparent"
            label={{ ...QUADRANT_LABEL, value: "ELITE", position: "insideTopRight" }}
          />
          <ReferenceArea
            x1={xMin}
            x2={average.offense}
            y1={yMin}
            y2={average.defense}
            fill="transparent"
            label={{ ...QUADRANT_LABEL, value: "DEFENSE-FIRST", position: "insideTopLeft" }}
          />
          <ReferenceArea
            x1={average.offense}
            x2={xMax}
            y1={average.defense}
            y2={yMax}
            fill="transparent"
            label={{ ...QUADRANT_LABEL, value: "OFFENSE-FIRST", position: "insideBottomRight" }}
          />
          <ReferenceArea
            x1={xMin}
            x2={average.offense}
            y1={average.defense}
            y2={yMax}
            fill="transparent"
            label={{ ...QUADRANT_LABEL, value: "STRUGGLING", position: "insideBottomLeft" }}
          />
          <ReferenceLine x={average.offense} stroke="var(--text-muted)" strokeOpacity={0.5} />
          <ReferenceLine y={average.defense} stroke="var(--text-muted)" strokeOpacity={0.5} />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                variant="frosted-glass"
                hideIndicator
                labelFormatter={(_, items) => (
                  <TooltipHeader point={items[0]?.payload as TeamPoint | undefined} />
                )}
                formatter={(value, name) => <TooltipRow name={String(name)} value={Number(value)} />}
              />
            }
          />
          <Scatter data={points} shape={<TeamLogoMarker />} />
        </ScatterChart>
      </ChartContainer>
      <p className="pt-2 text-xs text-[var(--text-muted)]">
        EPA (expected points added) is how much a play changes a team's expected points, based on
        down, distance, and field position. Each logo is a team's average per pass or run this
        regular season; the lighter lines mark the league average.
      </p>
    </div>
  )
}

function TeamEfficiencyScatter() {
  const efficiency = useFetch<TeamEfficiency[]>("/teams/efficiency")
  const teams = useFetch<TeamInfo[]>("/teams")

  const points = useMemo(
    () => (efficiency.data && teams.data ? toTeamPoints(efficiency.data, teams.data) : null),
    [efficiency.data, teams.data],
  )
  const loading = efficiency.loading || teams.loading
  const error = efficiency.error ?? teams.error

  return (
    <Panel title="Team Efficiency" className="flex min-h-[340px] flex-1 flex-col">
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && (
        <p className="p-4 text-sm text-[var(--negative)]">Couldn't load team efficiency: {error}</p>
      )}
      {points && points.length === 0 && (
        <p className="p-4 text-sm text-[var(--text-secondary)]">No plays to chart yet.</p>
      )}
      {points && points.length > 0 && <EfficiencyChart points={points} />}
    </Panel>
  )
}

export default TeamEfficiencyScatter
