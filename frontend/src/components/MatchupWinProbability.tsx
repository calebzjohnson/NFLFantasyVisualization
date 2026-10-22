// MatchupWinProbability.tsx
// The home team's win probability through the game, as a gradient area split
// at the 50% line: above it the home team is favoured and the fill takes
// their colour, below it the away team's. One series, not two - the pair
// always sums to 100, so a second line would say nothing the first doesn't.
// Hovering reads out both teams at that moment.
import { Area, AreaChart, CartesianGrid, Line, ReferenceLine, XAxis, YAxis } from "recharts"
import { quarterLabel, type Matchup, type WinProbabilityPoint } from "../data/matchups"
import { contrastingPair } from "../data/teamColors"
import type { TeamInfo } from "../data/teams"
import ChartDataTable from "./ChartDataTable"
import { ChartContainer } from "./evilcharts/ui/recharts-chart"
import { ChartTooltip } from "./evilcharts/ui/recharts-tooltip"
import Panel from "./Panel"

const QUARTER_SECONDS = 900
const QUARTER_TICKS = [0, 900, 1800, 2700, 3600]
const FULL_GAME = 3600

function clock(elapsed: number): string {
  return `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
}

// Coloured for whoever is favoured at that moment, so the dot agrees with
// the fill it's sitting on.
function ActiveDot({
  cx,
  cy,
  value,
  colors,
}: {
  cx?: number
  cy?: number
  value?: number
  colors: [string, string]
}) {
  if (cx === undefined || cy === undefined) return null
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4.5}
      fill={(value ?? 50) >= 50 ? colors[1] : colors[0]}
      stroke="var(--surface-1)"
      strokeWidth={2}
    />
  )
}

function Readout({
  active,
  payload,
  away,
  home,
  colors,
}: {
  active?: boolean
  payload?: { payload: WinProbabilityPoint }[]
  away: string
  home: string
  colors: [string, string]
}) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null
  const sides: [string, number, string][] = [
    [home, point.home_wp, colors[1]],
    [away, Math.round((100 - point.home_wp) * 10) / 10, colors[0]],
  ]

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2 text-xs shadow-lg">
      <p className="pb-1 text-[var(--text-muted)]">
        {quarterLabel(point.quarter)} · {clock(point.elapsed)} elapsed
      </p>
      {sides
        .sort((a, b) => b[1] - a[1])
        .map(([team, value, color]) => (
          <p key={team} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-[2px]"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span className="text-[var(--text-secondary)]">{team}</span>
            <span className="ml-auto pl-3 font-display tabular-nums text-[var(--text-primary)]">
              {value}%
            </span>
          </p>
        ))}
    </div>
  )
}

function MatchupWinProbability({ matchup, teams }: { matchup: Matchup; teams: TeamInfo[] }) {
  const points = matchup.breakdown?.win_probability ?? []
  if (points.length === 0) return null
  const { away_team, home_team } = matchup.game
  const colors = contrastingPair(teams, away_team, home_team)
  // Each side clamped to the 50 baseline, so an area only departs from it
  // while its own team is favoured.
  const series = points.map((point) => ({
    ...point,
    home_side: Math.max(point.home_wp, 50),
    away_side: Math.min(point.home_wp, 50),
  }))
  const config = {
    home_side: { label: `${home_team} win probability`, color: colors[1] },
    away_side: { label: `${away_team} win probability`, color: colors[0] },
  }

  return (
    <Panel title="Win Probability">
      <div className="px-4 py-3">
        <ChartContainer
          config={config}
          className="aspect-[5/2]"
          label={`Win probability through the game. Above the halfway line ${home_team} is favoured, below it ${away_team}.`}
        >
          <AreaChart data={series} margin={{ top: 8, right: 16, bottom: 20, left: 4 }}>
            <defs>
              <linearGradient id="wp-home" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[1]} stopOpacity={0.7} />
                <stop offset="100%" stopColor={colors[1]} stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="wp-away" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[0]} stopOpacity={0.1} />
                <stop offset="100%" stopColor={colors[0]} stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
            <XAxis
              type="number"
              dataKey="elapsed"
              domain={[0, FULL_GAME]}
              ticks={QUARTER_TICKS}
              tickFormatter={(value) =>
                Number(value) === 0 ? "Kick" : `Q${Number(value) / QUARTER_SECONDS}`
              }
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value) => `${value}%`}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <ReferenceLine y={50} stroke="var(--border)" strokeDasharray="4 4" />
            <ChartTooltip
              cursor={{ stroke: "var(--text-muted)", strokeDasharray: "3 3" }}
              content={
                <Readout away={away_team} home={home_team} colors={colors} />
              }
            />
            {/* Two areas off a shared 50 baseline rather than one gradient:
                a gradient stop is placed in the shape's own bounding box, so
                its "50%" drifts with the data instead of sitting on the
                halfway line. Each area only leaves the baseline on its own
                side, so the colour changes exactly where the favourite does. */}
            <Area
              dataKey="home_side"
              stroke={colors[1]}
              strokeWidth={2}
              fill="url(#wp-home)"
              baseValue={50}
              dot={false}
              activeDot={false}
              type="monotone"
              isAnimationActive={false}
            />
            <Area
              dataKey="away_side"
              stroke={colors[0]}
              strokeWidth={2}
              fill="url(#wp-away)"
              baseValue={50}
              dot={false}
              activeDot={false}
              type="monotone"
              isAnimationActive={false}
            />
            {/* Invisible, and carrying the real number: the two filled areas
                are each clamped to the 50 line, so a dot on either would
                stick to the middle whenever that side wasn't the favourite. */}
            <Line
              dataKey="home_wp"
              stroke="none"
              dot={false}
              activeDot={<ActiveDot colors={colors} />}
              type="monotone"
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
        <p className="pt-2 text-xs text-[var(--text-muted)]">
          Shaded toward whichever team was favoured at that moment — {home_team} above the halfway
          line, {away_team} below it. Hover for both teams' numbers.
        </p>
        <ChartDataTable
          caption={`Win probability at every play of the game`}
          columns={["Elapsed", "Quarter", `${home_team}`, `${away_team}`]}
          rows={points.map((point) => [
            clock(point.elapsed),
            quarterLabel(point.quarter),
            `${point.home_wp}%`,
            `${Math.round((100 - point.home_wp) * 10) / 10}%`,
          ])}
        />
      </div>
    </Panel>
  )
}

export default MatchupWinProbability
