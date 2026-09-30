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

// Only the fields this chart reads - the pool is shared with (and fetched
// for) LeagueComparisonBeeswarm, which uses the rest.
interface RadarPool {
  players: { player_id: string; axes: RadarAxis[] }[]
}

// Axes where a lower raw number is better - the backend ranks them in
// reverse, so a point further out still means "better than his peers."
const LOWER_IS_BETTER = "Lower is better, so a lower number ranks higher here."

// Plain-language explanations for the footnote, keyed by axis key (labels
// come from the backend and are abbreviated to fit the chart).
const AXIS_GLOSSARY: Record<string, string> = {
  epa_per_dropback:
    "Expected Points Added per dropback - how much each pass play improved the team's chances of scoring.",
  success_rate: "How often a play moved the team closer to scoring rather than setting it back.",
  any_a: "Adjusted Net Yards per Attempt - passing yards per throw, with bonus credit for touchdowns and penalties for interceptions and sacks.",
  passing_cpoe: "Completion % Over Expected - how many more passes he completes than an average QB would on the same throws.",
  adot: "Average Depth of Target - how far downfield his passes travel on average.",
  qb_rushing_epa_per_play: "Expected Points Added per scramble or designed run - how much each of his own carries improved the team's chances of scoring.",
  rushing_epa_per_play: "Expected Points Added per carry - how much each run improved the team's chances of scoring.",
  yards_per_carry: "Average rushing yards gained per carry.",
  rush_yards_over_expected: "Rushing yards gained beyond what an average back would get given the blocking and defenders in front of him.",
  receiving_epa_per_target: "Expected Points Added each time he's targeted.",
  redzone_touch_share: "His share of the team's carries and catches inside the opponent's 20-yard line.",
  wopr: "Weighted Opportunity Rating - blends his share of the team's targets and of its passing yardage downfield into one measure of how involved he is.",
  yac_per_reception: "Yards After Catch per reception (REC) - how much he gains running with the ball once he's caught it.",
  avg_separation: "Average distance, in yards, from the nearest defender when the ball arrives.",
  yards_per_snap: "Receiving yards per play he's on the field.",
  yards_per_target: "Receiving yards each time he's targeted.",
  redzone_target_share: "His share of the team's targets inside the opponent's 20-yard line.",
  pressure_rate: "How often he pressures the quarterback (a sack, hit, or hurry), per 100 defensive snaps.",
  sack_rate: "Of the times he pressures the quarterback, how often he finishes with a sack.",
  tfl_per_100_snaps: "Tackles behind the line of scrimmage, per 100 defensive snaps.",
  tackles_per_100_snaps: "Tackles made, per 100 defensive snaps.",
  missed_tackle_pct: `Share of his tackle attempts that he missed. ${LOWER_IS_BETTER}`,
  defense_snap_pct: "Share of his team's defensive snaps he's on the field for, in games he played.",
  yards_per_target_allowed: `Receiving yards given up each time a pass is thrown his way. ${LOWER_IS_BETTER}`,
  passer_rating_allowed: `The passer rating quarterbacks have when throwing at him. ${LOWER_IS_BETTER}`,
  completion_pct_allowed: `How often a pass thrown his way is caught. ${LOWER_IS_BETTER}`,
  ball_production:
    "How often he gets a hand on the ball - a pass broken up or intercepted - when it's thrown his way.",
}

// Axes sourced from NFL Next Gen Stats rather than play-by-play - NGS lags
// behind and imposes its own minimum-volume thresholds, so these can go
// blank for a player even after the rest of their radar is populated.
const NGS_AXES = new Set(["avg_separation", "rush_yards_over_expected"])

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

function PlayerRadarChart({
  playerId,
  position,
  teamColor,
}: {
  playerId: string
  position: string
  teamColor: string
}) {
  // Same path as LeagueComparisonBeeswarm, so useFetch's cache serves both
  // charts from one request - this chart just picks out its own row.
  const pool = useFetch<RadarPool>(`/players/radar-pool?position=${position}`)
  const { error, loading } = pool
  const data = pool.data?.players.find((player) => player.player_id === playerId)
  // Missing from the pool means the player hasn't hit the minimum season
  // volume for a radar profile (keeps low-volume/backup players out of the
  // percentile ranks) - a normal, expected state for those players, not an
  // error.
  const notEnoughVolume = !!pool.data && !data
  const ngsAxisLabels = data?.axes.filter((axis) => NGS_AXES.has(axis.key)).map((axis) => axis.label) ?? []

  return (
    <Panel title="Player Breakdown">
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {notEnoughVolume && (
        <p className="p-4 text-sm text-[var(--text-secondary)]">
          Not enough season volume yet for a radar profile.
        </p>
      )}
      {error && !notEnoughVolume && (
        <p className="p-4 text-sm text-[var(--negative)]">Couldn't load radar: {error}</p>
      )}
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
          <details className="px-3 pb-1 pt-2 text-xs text-[var(--text-muted)]">
            <summary className="cursor-pointer text-[var(--text-secondary)]">What do these stats mean?</summary>
            <dl className="mt-2 grid gap-1.5">
              {data.axes.map((axis) => (
                <div key={axis.key}>
                  <dt className="inline font-medium text-[var(--text-secondary)]">{axis.label}: </dt>
                  <dd className="inline">{AXIS_GLOSSARY[axis.key] ?? "—"}</dd>
                </div>
              ))}
            </dl>
            {ngsAxisLabels.length > 0 && (
              <p className="mt-2 border-t border-[var(--border)] pt-2">
                {ngsAxisLabels.join(" and ")} {ngsAxisLabels.length > 1 ? "are" : "is"} sourced from
                NFL Next Gen Stats, which can take time to update or require higher minimum touches
                to appear.
              </p>
            )}
          </details>
        </div>
      )}
    </Panel>
  )
}

export default PlayerRadarChart
