// LeagueComparisonBeeswarm.tsx
// One vertical swarm column per radar axis: every qualifying player at the
// position gets a dot, positioned on the Y axis by percentile (same 0-100
// scale the radar chart uses) and jittered horizontally within its column so
// dots with close percentiles don't overlap. This player's dot is
// highlighted in their team color on every axis; every dot links to that
// player's page.
import { memo, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Scatter, ScatterChart, XAxis, YAxis } from "recharts"
import { useFetch } from "../lib/useFetch"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import { ChartTooltip } from "./evilcharts/ui/recharts-tooltip"
import Panel from "./Panel"

interface PoolAxis {
  key: string
  percentile: number | null
}

interface PoolPlayer {
  player_id: string
  name: string
  team: string
  axes: PoolAxis[]
}

interface RadarPool {
  position: string
  axes: { key: string; label: string }[]
  players: PoolPlayer[]
}

interface PlayerRadar {
  player_id: string
  position: string
  axes: { key: string; label: string; value: number | null; percentile: number | null }[]
}

interface SwarmPoint {
  player: PoolPlayer
  axisIndex: number
  axisLabel: string
  x: number // axisIndex + horizontal jitter
  y: number // percentile, 0-100
}

const chartConfig = {
  percentile: { label: "Percentile" },
} satisfies ChartConfig

// Axes sourced from NFL Next Gen Stats rather than play-by-play - see the
// matching note in PlayerRadarChart.tsx.
const NGS_AXES = new Set(["avg_separation", "rush_yards_over_expected"])

// Adaptive clustering, not fixed bins: walk players in percentile order and
// start a new cluster whenever the gap to the next player exceeds the
// threshold, then jitter each cluster's dots alternating left/right of the
// column's center. Looser gaps produce tighter, more legible clusters than
// rigid bins would for an uneven real-world percentile distribution.
const CLUSTER_GAP = 2.5
const JITTER_STEP = 0.07
const MAX_JITTER = 0.42

function layoutColumn(players: PoolPlayer[], axisIndex: number, axisKey: string, axisLabel: string): SwarmPoint[] {
  const withPct = players
    .map((player) => ({
      player,
      pct: player.axes.find((axis) => axis.key === axisKey)?.percentile,
    }))
    .filter((entry): entry is { player: PoolPlayer; pct: number } => entry.pct != null)
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
        player: entry.player,
        axisIndex,
        axisLabel,
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
  highlightPlayerId,
  teamColor,
  onSelect,
}: {
  cx?: number
  cy?: number
  payload?: SwarmPoint
  highlightPlayerId: string
  teamColor: string
  onSelect: (playerId: string) => void
}) {
  if (cx === undefined || cy === undefined || !payload) return null
  const isHighlighted = payload.player.player_id === highlightPlayerId

  return (
    <g
      onClick={() => onSelect(payload.player.player_id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect(payload.player.player_id)
      }}
      aria-label={`View ${payload.player.name}'s player page`}
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

function SwarmTooltip({ active, payload }: { active?: boolean; payload?: { payload: SwarmPoint }[] }) {
  // An empty-but-present element, not null - keeps the tooltip from
  // resetting position to (0,0) and flying in from the corner on each hover.
  if (!active || !payload?.length) return <span className="p-4" />
  const point = payload[0].payload
  return (
    <div className="grid min-w-36 gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/70 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm">
      <div className="font-medium text-[var(--text-primary)]">
        {point.player.name} <span className="text-[var(--text-muted)]">· {point.player.team}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[var(--text-secondary)]">{point.axisLabel}</span>
        <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
          {Math.round(point.y)}th
        </span>
      </div>
    </div>
  )
}

function LeagueComparisonBeeswarm({ playerId, teamColor }: { playerId: string; teamColor: string }) {
  const navigate = useNavigate()
  // Shares the useFetch cache with PlayerRadarChart's own fetch of the same
  // path - just reads the position bucket, no extra network cost.
  const playerRadar = useFetch<PlayerRadar>(`/players/${playerId}/radar`)
  const position = playerRadar.data?.position
  const pool = useFetch<RadarPool>(position ? `/players/radar-pool?position=${position}` : null)

  const points = useMemo(() => {
    if (!pool.data) return null
    return pool.data.axes.flatMap((axis, index) =>
      layoutColumn(pool.data!.players, index, axis.key, axis.label),
    )
  }, [pool.data])

  // pool stays permanently "loading" while position is unknown (useFetch's
  // null-path behavior), which would otherwise never clear once playerRadar
  // 404s - only count it once we actually have a position to fetch for.
  const loading = playerRadar.loading || (!!position && pool.loading)
  const error = playerRadar.error ?? pool.error
  // A 404 on the player's own radar means he hasn't hit the minimum season
  // volume for a radar profile - expected for a low-volume/backup player,
  // not an error. Without his own profile we can't tell which position's
  // pool to show him against, so the comparison just isn't available yet.
  const notEnoughVolume = playerRadar.error?.includes("(404)") ?? false
  const ngsAxisLabels =
    pool.data?.axes.filter((axis) => NGS_AXES.has(axis.key)).map((axis) => axis.label) ?? []

  function goToPlayer(id: string) {
    navigate(`/players/${id}`)
  }

  return (
    <Panel title="League Comparison">
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {notEnoughVolume && (
        <p className="p-4 text-sm text-[var(--text-secondary)]">
          Not enough season volume yet for a league comparison.
        </p>
      )}
      {error && !notEnoughVolume && (
        <p className="p-4 text-sm text-[var(--negative)]">Couldn't load league comparison: {error}</p>
      )}
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
              <ChartTooltip content={<SwarmTooltip />} cursor={false} />
              <Scatter
                data={points}
                shape={(props: { cx?: number; cy?: number; payload?: SwarmPoint }) => (
                  <SwarmDot
                    {...props}
                    highlightPlayerId={playerId}
                    teamColor={teamColor}
                    onSelect={goToPlayer}
                  />
                )}
                isAnimationActive={false}
              />
            </ScatterChart>
          </ChartContainer>
          <p className="px-3 pb-1 text-xs text-[var(--text-muted)]">
            Every qualifying player at the position this season, positioned by percentile rank on each
            axis - click a dot to view that player.
            {ngsAxisLabels.length > 0 &&
              ` ${ngsAxisLabels.join(" and ")} ${ngsAxisLabels.length > 1 ? "are" : "is"} sourced from NFL Next Gen Stats, which can take time to update or require higher minimum touches to appear, so those columns may have fewer dots.`}
          </p>
        </div>
      )}
    </Panel>
  )
}

export default LeagueComparisonBeeswarm
