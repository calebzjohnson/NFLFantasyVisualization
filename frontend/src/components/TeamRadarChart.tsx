// TeamRadarChart.tsx
// Radar of the team's 6 identity axes (offense/defense EPA per play, red
// zone TD%, special teams EPA), each plotted as a percentile rank against
// the other 31 teams this season - not raw units, since EPA/play and a TD%
// don't share a scale. Hovering a vertex shows the underlying raw value and
// rank. Unlike the player radar, none of these axes are Next Gen Stats
// sourced (there's no team-level NGS dataset), so there's no data-lag note
// here.
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"
import { ordinal } from "../data/efficiency"
import type { TeamInfo } from "../data/teams"
import { radarRows, radarSummary } from "../lib/chartSummaries"
import { useFetch } from "../lib/useFetch"
import ChartDataTable from "./ChartDataTable"
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
// for) TeamLeagueComparisonBeeswarm, which uses the rest.
interface TeamRadarPool {
  teams: { team: string; axes: RadarAxis[] }[]
}

// Plain-language explanations for the footnote, keyed by axis key (labels
// come from the backend and are abbreviated to fit the chart).
const AXIS_GLOSSARY: Record<string, string> = {
  off_pass_epa: "Expected Points Added per pass play - how much each throw improves the team's chances of scoring, averaged across the season.",
  off_rush_epa: "Expected Points Added per run play - how much each carry improves the team's chances of scoring, averaged across the season.",
  off_redzone_td_pct: "Percentage of team's possessions inside the opponent's 20-yard line that result in a touchdown.",
  def_pass_epa: "Expected Points Added allowed per pass play - how much each throw against this defense improves the offense's chances of scoring.",
  def_rush_epa: "Expected Points Added allowed per run play - how much each carry against this defense improves the offense's chances of scoring.",
  special_teams_epa: "Total Expected Points Added from kicking, punting, and returns this season.",
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

function TeamRadarChart({ teamAbbr, teamColor }: { teamAbbr: string; teamColor: string }) {
  // Same path as TeamLeagueComparisonBeeswarm, so useFetch's cache serves
  // both charts from one request - this chart just picks out its own row.
  const pool = useFetch<TeamRadarPool>("/teams/radar-pool")
  const { error, loading } = pool
  const data = pool.data?.teams.find((team) => team.team === teamAbbr)
  // Cached by TeamPage already - just the display name for the summary.
  const teams = useFetch<TeamInfo[]>("/teams")
  const teamName = teams.data?.find((team) => team.team_abbr === teamAbbr)?.team_name ?? teamAbbr

  return (
    <Panel title="Team Breakdown">
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load radar: {error}</p>}
      {data && (
        <div className="p-3">
          <ChartContainer
            config={chartConfig}
            className="aspect-[4/3]"
            label={radarSummary(`The ${teamName}`, "every other team", data.axes)}
          >
            <RadarChart data={data.axes.map((axis) => ({ ...axis, reference: 50 }))}>
              <defs>
                {/* Brighter near the center, fading toward the points - a
                    soft glow rather than a flat fill. */}
                <radialGradient id="teamRadarFill" cx="50%" cy="50%" r="70%">
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
                fill="url(#teamRadarFill)"
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
            Each axis is this team's percentile rank across the league this season; the dashed ring
            marks the 50th percentile, or league average.
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
          </details>
          <ChartDataTable
            caption={`${teamName} percentile ranks across the league`}
            columns={["Stat", "Value", "Percentile"]}
            rows={radarRows(data.axes)}
          />
        </div>
      )}
    </Panel>
  )
}

export default TeamRadarChart
