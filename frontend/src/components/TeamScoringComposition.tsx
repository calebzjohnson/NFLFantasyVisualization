// TeamScoringComposition.tsx
// "Scoring Composition" donut: share of a team's points broken down by unit
// (passing, rushing, defense/special teams, kicking), toggled at the top
// between points for and points against - not "offense" and "defense", since
// every unit can contribute to either side (a pick-six is scored by the
// defense, and shows up as points against for the team that turned it over).
import { useState } from "react"
import { Cell, Pie, PieChart, Tooltip } from "recharts"
import { useFetch } from "../lib/useFetch"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import Panel from "./Panel"
import PositionGroupToggle from "./PositionGroupToggle"

interface ScoringCategory {
  key: string
  label: string
  points: number
}

interface ScoringSide {
  total_points: number
  categories: ScoringCategory[]
}

interface ScoringComposition {
  team: string
  offense: ScoringSide
  defense: ScoringSide
}

const VIEWS = ["points for", "points against"] as const
type View = (typeof VIEWS)[number]

const SIDE_BY_VIEW: Record<View, "offense" | "defense"> = {
  "points for": "offense",
  "points against": "defense",
}

// A validated categorical palette (see the dataviz skill's palette.md) -
// fixed hue order, assigned by category identity rather than cycled, so
// "Passing" is always the same color whether it's the biggest slice or the
// smallest. Two of these four slots read below 3:1 contrast on this site's
// white chart surface, so a color-only reading isn't reliable - the legend
// below the chart (not just the tooltip) is the relief for that.
const CATEGORY_COLORS: Record<string, string> = {
  passing: "#2a78d6",
  rushing: "#eb6834",
  defense_st: "#1baf7a",
  kicking: "#eda100",
}

const chartConfig = {
  points: { label: "Points" },
} satisfies ChartConfig

function ScoringTooltip({
  active,
  payload,
  totalPoints,
}: {
  active?: boolean
  payload?: { payload: ScoringCategory }[]
  totalPoints: number
}) {
  // An empty-but-present element, not null - keeps the tooltip from
  // resetting position to (0,0) and flying in from the corner on each hover.
  if (!active || !payload?.length) return <span className="p-4" />
  const category = payload[0].payload
  const share = totalPoints > 0 ? Math.round((category.points / totalPoints) * 100) : 0
  return (
    <div className="grid min-w-32 gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/70 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm">
      <div className="font-medium text-[var(--text-primary)]">{category.label}</div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[var(--text-secondary)]">Points</span>
        <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
          {category.points} ({share}%)
        </span>
      </div>
    </div>
  )
}

function ScoringLegend({ categories }: { categories: ScoringCategory[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-3 pb-1">
      {categories.map((category) => (
        <li key={category.key} className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ backgroundColor: CATEGORY_COLORS[category.key] }}
          />
          {category.label} <span className="font-mono text-[var(--text-muted)]">{category.points}</span>
        </li>
      ))}
    </ul>
  )
}

function TeamScoringComposition({ teamAbbr }: { teamAbbr: string }) {
  const { data, error, loading } = useFetch<ScoringComposition>(`/teams/${teamAbbr}/scoring`)
  const [view, setView] = useState<View>("points for")

  const side = data?.[SIDE_BY_VIEW[view]]

  return (
    <Panel
      title="Scoring Composition"
      actions={
        <PositionGroupToggle options={VIEWS} active={view} onChange={setView} aria-label="View" />
      }
    >
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load scoring: {error}</p>}
      {side && (
        <>
          <div className="relative p-3">
            <ChartContainer config={chartConfig} className="aspect-[4/3]">
              <PieChart>
                <Tooltip
                  content={<ScoringTooltip totalPoints={side.total_points} />}
                  animationDuration={200}
                  wrapperStyle={{ zIndex: 20 }}
                />
                <Pie
                  data={side.categories}
                  dataKey="points"
                  nameKey="label"
                  innerRadius="60%"
                  outerRadius="85%"
                  paddingAngle={2}
                  stroke="var(--surface-1)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {side.categories.map((category) => (
                    <Cell key={category.key} fill={CATEGORY_COLORS[category.key]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-3 flex flex-col items-center justify-center">
              <span className="font-display text-3xl font-bold text-[var(--text-primary)]">
                {side.total_points}
              </span>
              <span className="max-w-[60%] text-center text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
                {view === "points for" ? "Points Scored" : "Points Allowed"}
              </span>
            </div>
          </div>
          <ScoringLegend categories={side.categories} />
          <p className="px-3 pb-2 text-xs text-[var(--text-muted)]">
            {view === "points for"
              ? "Share of the points this team has scored this season, by unit."
              : "Share of the points this team has allowed this season, by unit."}
          </p>
        </>
      )}
    </Panel>
  )
}

export default TeamScoringComposition
