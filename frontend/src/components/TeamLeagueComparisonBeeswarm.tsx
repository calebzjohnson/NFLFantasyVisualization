// TeamLeagueComparisonBeeswarm.tsx
// One vertical swarm column per team radar axis: every team gets a dot,
// positioned on the Y axis by percentile (same 0-100 scale the team radar
// uses) and jittered horizontally within its column so dots with close
// percentiles don't overlap. This team's dot is highlighted in its own
// color on every axis; every dot links to that team's page. Mirrors
// LeagueComparisonBeeswarm.tsx's player-page version, one row per team
// instead of one row per player.
import { memo, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Scatter, ScatterChart, XAxis, YAxis } from "recharts"
import { teamPath, type TeamInfo } from "../data/teams"
import { ordinal } from "../data/efficiency"
import { useFetch } from "../lib/useFetch"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import { ChartTooltip } from "./evilcharts/ui/recharts-tooltip"
import Panel from "./Panel"

interface PoolAxis {
  key: string
  value: number | null
  percentile: number | null
}

interface PoolTeam {
  team: string
  axes: PoolAxis[]
}

interface TeamRadarPool {
  axes: { key: string; label: string }[]
  teams: PoolTeam[]
}

interface SwarmPoint {
  team: PoolTeam
  axisIndex: number
  axisLabel: string
  value: number | null
  x: number // axisIndex + horizontal jitter
  y: number // percentile, 0-100
}

const chartConfig = {
  percentile: { label: "Percentile" },
} satisfies ChartConfig

// Same adaptive-clustering layout as the player beeswarm - see that file for
// the reasoning (looser gaps read better than rigid bins for an uneven
// real-world percentile distribution).
const CLUSTER_GAP = 2.5
const JITTER_STEP = 0.07
const MAX_JITTER = 0.42

function layoutColumn(teams: PoolTeam[], axisIndex: number, axisKey: string, axisLabel: string): SwarmPoint[] {
  const withPct = teams
    .flatMap((team) => {
      const axis = team.axes.find((a) => a.key === axisKey)
      return axis?.percentile != null ? [{ team, pct: axis.percentile, value: axis.value }] : []
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
      points.push({
        team: entry.team,
        axisIndex,
        axisLabel,
        value: entry.value,
        x: axisIndex + jitter,
        y: entry.pct,
      })
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

const SwarmDot = memo(function SwarmDot({
  cx,
  cy,
  payload,
  highlightTeam,
  teamColor,
  onSelect,
}: {
  cx?: number
  cy?: number
  payload?: SwarmPoint
  highlightTeam: string
  teamColor: string
  onSelect: (team: string) => void
}) {
  if (cx === undefined || cy === undefined || !payload) return null
  const isHighlighted = payload.team.team === highlightTeam

  return (
    <g
      onClick={() => onSelect(payload.team.team)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect(payload.team.team)
      }}
      aria-label={`View ${payload.team.team}'s team page`}
      className="cursor-pointer"
    >
      <circle cx={cx} cy={cy} r={10} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={isHighlighted ? 6 : 3.5}
        fill={isHighlighted ? teamColor : "var(--text-muted)"}
        fillOpacity={isHighlighted ? 1 : 0.55}
        stroke={isHighlighted ? "var(--surface-1)" : "none"}
        strokeWidth={isHighlighted ? 2 : 0}
      />
    </g>
  )
})

export function SwarmTooltip({
  active,
  payload,
  nameByTeam,
}: {
  active?: boolean
  payload?: { payload: SwarmPoint }[]
  nameByTeam: Map<string, string>
}) {
  // An empty-but-present element, not null - keeps the tooltip from
  // resetting position to (0,0) and flying in from the corner on each hover.
  if (!active || !payload?.length) return <span className="p-4" />
  const point = payload[0].payload
  return (
    <div className="grid min-w-36 gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/70 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm">
      <div className="font-medium text-[var(--text-primary)]">
        {nameByTeam.get(point.team.team) ?? point.team.team}
      </div>
      <div className="text-[var(--text-secondary)]">{point.axisLabel}</div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[var(--text-secondary)]">Value</span>
        <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
          {point.value ?? "—"}
        </span>
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

function TeamLeagueComparisonBeeswarm({ teamAbbr, teamColor }: { teamAbbr: string; teamColor: string }) {
  const navigate = useNavigate()
  const pool = useFetch<TeamRadarPool>("/teams/radar-pool")
  // Shares the useFetch cache with TeamPage's own fetch of the same path -
  // just reads team names for the tooltip, no extra network cost.
  const teams = useFetch<TeamInfo[]>("/teams")
  const nameByTeam = useMemo(
    () => new Map(teams.data?.map((team) => [team.team_abbr, team.team_name]) ?? []),
    [teams.data],
  )

  const points = useMemo(() => {
    if (!pool.data) return null
    return pool.data.axes.flatMap((axis, index) => layoutColumn(pool.data!.teams, index, axis.key, axis.label))
  }, [pool.data])

  const loading = pool.loading || teams.loading
  const error = pool.error ?? teams.error

  function goToTeam(team: string) {
    navigate(teamPath(team))
  }

  return (
    <Panel title="League Comparison">
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load league comparison: {error}</p>}
      {points && pool.data && (
        <div className="p-3">
          <ChartContainer config={chartConfig} className="aspect-auto h-[420px]">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
              <XAxis
                type="number"
                dataKey="x"
                domain={[-0.5, pool.data.axes.length - 0.5]}
                ticks={pool.data.axes.map((_, i) => i)}
                tickFormatter={(i: number) => pool.data!.axes[i]?.label ?? ""}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
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
              <ChartTooltip content={<SwarmTooltip nameByTeam={nameByTeam} />} cursor={false} />
              <Scatter
                data={points}
                shape={(props: { cx?: number; cy?: number; payload?: SwarmPoint }) => (
                  <SwarmDot
                    {...props}
                    highlightTeam={teamAbbr}
                    teamColor={teamColor}
                    onSelect={goToTeam}
                  />
                )}
                isAnimationActive={false}
              />
            </ScatterChart>
          </ChartContainer>
          <p className="px-3 pb-1 text-xs text-[var(--text-muted)]">
            Every team in the league this season, positioned by percentile rank on each axis - click a
            dot to view that team.
          </p>
        </div>
      )}
    </Panel>
  )
}

export default TeamLeagueComparisonBeeswarm
