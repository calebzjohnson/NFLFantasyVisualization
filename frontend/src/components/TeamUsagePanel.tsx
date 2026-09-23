// TeamUsagePanel.tsx
// "Team Usage" panel with two views, toggled at the top: a season-snapshot
// donut (one slice per player in the relevant pool, this player highlighted
// in their team color) and a week-by-week stacked bar chart of the same
// player-vs-rest-of-team split, so a trend (workload growing/shrinking) is
// visible alongside the season total.
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import Panel from "./Panel"
import PositionGroupToggle from "./PositionGroupToggle"

interface Teammate {
  player_id: string
  name: string
  value: number
}

interface WeeklyPoint {
  week: number
  player_value: number
  team_value: number
}

interface UsageShare {
  player_id: string
  team: string
  metric: string
  label: string
  player_value: number
  team_value: number
  teammates: Teammate[]
  weekly: WeeklyPoint[]
}

interface DonutSlice {
  player_id?: string
  name: string
  value: number
  isPlayer: boolean
}

const VIEWS = ["season", "weekly"] as const
type View = (typeof VIEWS)[number]

const chartConfig = {
  value: { label: "Share" },
} satisfies ChartConfig

const TEAMMATE_FILL = "var(--border)"

// "Touch Share vs Backfield" -> "Rest of backfield"; a label with no " vs "
// scope (e.g. "Target Share", pooled across the whole team) falls back to
// "Rest of team".
function restOfLabel(label: string): string {
  const [, scope] = label.split(" vs ")
  return scope ? `Rest of ${scope.toLowerCase()}` : "Rest of team"
}

// This panel covers 3 different metrics (see USAGE_METRIC_BY_POSITION_GROUP
// on the backend) behind one generic donut/bar component, so the caption is
// picked by metric rather than hardcoded for one position.
function usageCaption(metric: string, weekly: boolean): string {
  if (metric === "td_involvement") {
    return weekly
      ? "Team touchdowns each week this player passed or ran in himself, vs. touchdowns that did not involve this player."
      : "Share of the team's touchdowns this player passed or ran in himself this season, vs. touchdowns that did not involve this player."
  }
  if (metric === "touches") {
    return weekly
      ? "Backfield touches (carries + receptions) this player took each week, vs. the rest of the backfield."
      : "Share of the backfield's touches (carries + receptions) this player has taken this season."
  }
  return weekly
    ? "Targets this player drew each week, vs. the rest of the team."
    : "Share of the team's targets this player has drawn this season."
}

// Custom rather than the shared ChartTooltipContent, which assumes one
// tooltip covers a whole series - here each slice is its own player.
function UsageTooltip({ active, payload }: { active?: boolean; payload?: { payload: DonutSlice }[] }) {
  // An empty-but-present element, not null - keeps Recharts' tooltip wrapper
  // mounted between hovers so it doesn't reset position to (0,0) and animate
  // in from the corner every time.
  if (!active || !payload?.length) return <span className="p-4" />
  const slice = payload[0].payload
  return (
    <div className="flex items-baseline justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/70 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm">
      <span className="font-medium text-[var(--text-primary)]">{slice.name}</span>
      <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
        {slice.value}
      </span>
    </div>
  )
}

function UsageDonut({
  playerName,
  teamColor,
  usage,
  onSelect,
}: {
  playerName: string
  teamColor: string
  usage: UsageShare
  onSelect: (playerId: string) => void
}) {
  const data: DonutSlice[] = [
    { name: playerName, value: usage.player_value, isPlayer: true },
    ...usage.teammates.map((teammate) => ({ ...teammate, isPlayer: false })),
  ]
  const sharePct = Math.round((usage.player_value / usage.team_value) * 100)

  return (
    <>
      <div className="relative p-3">
        <ChartContainer config={chartConfig} className="aspect-[4/3]">
          <PieChart>
            <Tooltip content={<UsageTooltip />} animationDuration={200} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="var(--surface-1)"
              strokeWidth={2}
              isAnimationActive={false}
              onClick={(sector: { player_id?: string; payload?: DonutSlice }) => {
                const playerId = sector.player_id ?? sector.payload?.player_id
                if (playerId) onSelect(playerId)
              }}
            >
              {data.map((slice) => (
                <Cell
                  key={slice.name}
                  fill={slice.isPlayer ? teamColor : TEAMMATE_FILL}
                  cursor={slice.player_id ? "pointer" : "default"}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-3 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold text-[var(--text-primary)]">{sharePct}%</span>
          <span className="max-w-[60%] text-center text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
            {usage.label.split(" vs ")[0]}
          </span>
        </div>
      </div>
      <p className="px-3 pb-2 text-xs text-[var(--text-muted)]">{usageCaption(usage.metric, false)}</p>
    </>
  )
}

interface WeekBar {
  week: string
  player: number
  rest: number
  gap: number
}

function WeeklyTooltip({
  active,
  payload,
  label,
  restLabel,
}: {
  active?: boolean
  payload?: { payload: WeekBar }[]
  label?: string
  restLabel: string
}) {
  if (!active || !payload?.length) return <span className="p-4" />
  const bar = payload[0].payload
  return (
    <div className="grid min-w-32 gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/70 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm">
      <div className="font-medium text-[var(--text-primary)]">{label}</div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[var(--text-secondary)]">Player</span>
        <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
          {bar.player}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[var(--text-secondary)]">{restLabel}</span>
        <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">
          {bar.rest}
        </span>
      </div>
    </div>
  )
}

function UsageWeeklyChart({ teamColor, usage }: { teamColor: string; usage: UsageShare }) {
  // A small transparent "gap" segment stacked between the two real ones -
  // Recharts abuts stacked bar segments with no space between them and
  // radius on a stacked segment only rounds outer corners, not the seam, so
  // a real visual gap needs its own (invisible) stack member.
  const maxTotal = Math.max(...usage.weekly.map((week) => week.team_value), 1)
  const gap = maxTotal * 0.02
  const data: WeekBar[] = usage.weekly.map((week) => ({
    week: `W${week.week}`,
    player: week.player_value,
    rest: Math.max(week.team_value - week.player_value, 0),
    gap,
  }))
  const peak = data.reduce((best, row) => (row.player > best.player ? row : best))

  return (
    <div className="p-3">
      <div className="mb-2 flex items-start justify-between gap-4 px-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] tracking-wider text-[var(--text-muted)] uppercase">Best Week</span>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[var(--text-primary)]">
              {peak.player}
            </span>
            <span className="text-sm text-[var(--text-secondary)]">in {peak.week}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 pt-1">
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: teamColor }} />
            {usage.label.split(" vs ")[0]}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: TEAMMATE_FILL }}
            />
            {restOfLabel(usage.label)}
          </span>
        </div>
      </div>
      <ChartContainer config={chartConfig} className="aspect-[4/3]">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <XAxis
            dataKey="week"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
          />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={<WeeklyTooltip restLabel={restOfLabel(usage.label)} />}
          />
          <Bar dataKey="player" stackId="usage" fill={teamColor} radius={6} isAnimationActive={false} />
          <Bar dataKey="gap" stackId="usage" fill="transparent" isAnimationActive={false} />
          <Bar
            dataKey="rest"
            stackId="usage"
            fill={TEAMMATE_FILL}
            radius={6}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
      <p className="pt-2 text-xs text-[var(--text-muted)]">{usageCaption(usage.metric, true)}</p>
    </div>
  )
}

function TeamUsagePanel({ playerId, playerName }: { playerId: string; playerName: string }) {
  const navigate = useNavigate()
  const usage = useFetch<UsageShare>(`/players/${playerId}/usage`)
  const teams = useFetch<TeamInfo[]>("/teams")
  const [view, setView] = useState<View>("season")

  const loading = usage.loading || teams.loading
  const error = usage.error ?? teams.error
  const teamColor =
    teams.data?.find((team) => team.team_abbr === usage.data?.team)?.team_color ?? "var(--accent)"

  function goToPlayer(id: string) {
    navigate(`/players/${id}`)
  }

  return (
    <Panel
      title={usage.data?.label ?? "Team Usage"}
      actions={
        <PositionGroupToggle options={VIEWS} active={view} onChange={setView} aria-label="View" />
      }
    >
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load usage: {error}</p>}
      {usage.data &&
        (view === "season" ? (
          <UsageDonut
            playerName={playerName}
            teamColor={teamColor}
            usage={usage.data}
            onSelect={goToPlayer}
          />
        ) : (
          <UsageWeeklyChart teamColor={teamColor} usage={usage.data} />
        ))}
    </Panel>
  )
}

export default TeamUsagePanel
