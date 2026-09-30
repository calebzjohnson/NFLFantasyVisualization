// TeamUsagePanel.tsx
// "Team Usage" panel with two views, toggled at the top: a week-by-week
// line chart of this player's share of the team's touches/targets/TDs (the
// default view, so a trend - workload growing/shrinking - is what you see
// first) and a season-snapshot donut of the same split.
import { useLayoutEffect, useRef, useState } from "react"
import type * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import Panel from "./Panel"
import PlayerAvatar from "./PlayerAvatar"
import PositionGroupToggle from "./PositionGroupToggle"

interface Teammate {
  player_id: string
  name: string
  value: number
}

interface UsagePlayerAmount {
  player_id: string | null
  name: string
  headshot_url: string | null
  value: number
}

interface WeeklyPoint {
  week: number
  team_value: number
  players: UsagePlayerAmount[]
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

const VIEWS = ["weekly", "season"] as const
type View = (typeof VIEWS)[number]

const chartConfig = {
  value: { label: "Share" },
} satisfies ChartConfig

const TEAMMATE_FILL = "var(--border)"

// "__other__" stands in for the backend's null player_id (QB TD
// involvement's "every touchdown that wasn't him" bucket) as an object key -
// every other id is a real gsis_id, which never collides with this string.
const OTHER_KEY = "__other__"

// A validated categorical palette (see the dataviz skill's palette.md) -
// fixed hue order, cycled for pools deeper than 8 players (a tackle-share
// pool can run 30+). The focus player uses their own team color instead, so
// this only needs to cover teammates.
const CATEGORICAL_PALETTE = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
]

// One color per player, shared by the donut and the weekly lines so a given
// teammate is always the same color in both - one fixed palette, assigned
// by rank in a single combined list (this player included, not a special
// case), ordered by season total descending. No team colors: the point is
// a consistent, position-based color per rank, the same across every
// player's page, not a color tied to which team happens to be selected.
// Doesn't apply to QB TD involvement: that's a simple this-QB-vs-
// everyone-else split, not a roster of individually ranked teammates - the
// QB gets the palette's first color and "Other" a fixed neutral, since
// "Other" isn't an individually ranked entity.
function buildColorByKey(usage: UsageShare, playerId: string): Map<string, string> {
  if (usage.metric === "td_involvement") {
    return new Map([
      [playerId, CATEGORICAL_PALETTE[0]],
      [OTHER_KEY, TEAMMATE_FILL],
    ])
  }
  const ranked = [
    { id: playerId, value: usage.player_value },
    ...usage.teammates.map((teammate) => ({ id: teammate.player_id, value: teammate.value })),
  ].sort((a, b) => b.value - a.value)
  return new Map(ranked.map((entry, index) => [entry.id, CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length]]))
}

// This panel covers 5 different metrics (see USAGE_METRIC_BY_POSITION_GROUP
// on the backend) behind one generic donut/bar component, so the caption is
// picked by metric rather than hardcoded for one position.
const USAGE_CAPTIONS: Record<string, { season: string; weekly: string }> = {
  td_involvement: {
    season:
      "Share of the team's touchdowns this player passed or ran in himself this season, vs. touchdowns that did not involve this player.",
    weekly:
      "Team touchdowns each week this player passed or ran in himself, vs. touchdowns that did not involve this player.",
  },
  touches: {
    season: "Share of the backfield's touches (carries + receptions) this player has taken this season.",
    weekly: "Backfield touches (carries + receptions) this player took each week, vs. the rest of the backfield.",
  },
  targets: {
    season: "Share of the team's targets this player has drawn this season.",
    weekly: "Targets this player drew each week, vs. the rest of the team.",
  },
  tackles: {
    season: "Share of the team's tackles this player has made this season.",
    weekly: "Tackles this player made each week, vs. the rest of the team.",
  },
  pressures: {
    season:
      "Share of the team's quarterback pressures (sacks, hits, and hurries) this player has created this season.",
    weekly: "Quarterback pressures this player created each week, vs. the rest of the team.",
  },
}

function usageCaption(metric: string, weekly: boolean): string {
  const caption = USAGE_CAPTIONS[metric] ?? USAGE_CAPTIONS.targets
  return weekly ? caption.weekly : caption.season
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

  const containerRef = useRef<HTMLDivElement>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  // recharts' default Pie tooltip snaps to wherever a slice first activates
  // and stays there while the cursor moves around inside that same slice -
  // overriding position with the live cursor coordinates makes it track
  // the mouse the way a Line/Bar/Scatter tooltip already does. Recharts owns
  // the tooltip's DOM node, so its size is read back off the rendered wrapper
  // (present from the first hover onward) rather than assumed - a guessed
  // width overshoots the flip and parks the card too far from the cursor.
  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const card = containerRef.current.querySelector<HTMLElement>(".recharts-tooltip-wrapper")
    const cardWidth = card?.offsetWidth || 150
    const cardHeight = card?.offsetHeight || 36
    const GAP = 12
    const flipLeft = x + GAP + cardWidth > rect.width
    const flipUp = y + GAP + cardHeight > rect.height
    setCursorPos({
      x: flipLeft ? Math.max(x - GAP - cardWidth, 0) : x + GAP,
      y: flipUp ? Math.max(y - GAP - cardHeight, 0) : y + GAP,
    })
  }

  return (
    <>
      <div ref={containerRef} className="relative p-3" onMouseMove={handleMouseMove}>
        <ChartContainer config={chartConfig} className="aspect-[4/3]">
          <PieChart>
            <Tooltip
              content={<UsageTooltip />}
              animationDuration={200}
              wrapperStyle={{ zIndex: 20 }}
              position={cursorPos ?? undefined}
            />
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

type WeekSharePoint = { week: string } & Record<string, number | string>

interface HoverMember {
  key: string
  name: string
  headshotUrl: string | null
  color: string
  value: number
  sharePct: number
}

interface HoverPoint {
  week: string
  sharePct: number
  members: HoverMember[]
}

// Every teammate its own real color, not a muted backdrop - the whole point
// is being able to tell who specifically is getting the work, not just that
// "someone else" is. Hover/click is handled entirely outside recharts' own
// Tooltip (see HoverCard below): mixing continuous Lines with discrete,
// per-player hoverable points inside recharts' built-in axis-synced tooltip
// is exactly the ambiguity TrendChart.tsx's custom hover already exists to
// avoid, so this reuses that same approach rather than fighting the
// built-in one.
const HOVER_HIT_RADIUS = 10

function HoverDot({
  cx,
  cy,
  payload,
  focusKey,
  onEnter,
  onLeave,
  onSelect,
}: {
  cx?: number
  cy?: number
  payload?: HoverPoint
  focusKey: string
  onEnter: (point: HoverPoint) => void
  onLeave: () => void
  onSelect: (playerId: string) => void
}) {
  if (cx === undefined || cy === undefined || !payload) return null
  const solo = payload.members.length === 1 ? payload.members[0] : null
  const clickable = solo !== null && solo.key !== OTHER_KEY
  const isFocus = solo?.key === focusKey
  const color = payload.members[0].color

  // The focus player reads as the same "hollow ring" mark as every other
  // chart on the site (radar, team radar); teammates are solid dots -
  // every dot is otherwise the same size, so the only signal is color/fill,
  // not size, regardless of hover or overlap state.
  const radius = 4

  return (
    <g
      onMouseEnter={() => onEnter(payload)}
      onMouseLeave={onLeave}
      // mousedown, not click: hovering already updates state (mounting the
      // hover card) on the way to a click, and recharts recreates these dot
      // nodes on that re-render mid-gesture - by the time mouseup happens
      // the original DOM node is gone, so the browser never synthesizes a
      // click on it. mousedown fires immediately, before any of that churn.
      onMouseDown={() => clickable && onSelect(solo.key)}
      className={clickable ? "cursor-pointer" : undefined}
    >
      <circle cx={cx} cy={cy} r={HOVER_HIT_RADIUS} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={isFocus ? "var(--surface-1)" : color}
        stroke={isFocus ? color : "var(--surface-1)"}
        strokeWidth={isFocus ? 2.5 : 1.5}
      />
    </g>
  )
}

function HoverCard({ point }: { point: HoverPoint }) {
  return (
    <div className="grid w-56 gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/90 p-2.5 text-xs shadow-xl backdrop-blur-sm">
      <div className="font-medium text-[var(--text-primary)]">{point.week}</div>
      {point.members.map((member) => (
        <div key={member.key} className="flex items-center gap-2">
          <PlayerAvatar
            name={member.name}
            headshot={member.headshotUrl}
            color={member.color}
            size="h-6 w-6"
          />
          <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{member.name}</span>
          <span className="shrink-0 font-mono font-medium tabular-nums text-[var(--text-primary)]">
            {member.value} ({Math.round(member.sharePct)}%)
          </span>
        </div>
      ))}
    </div>
  )
}

function UsageWeeklyChart({
  playerId,
  playerName,
  usage,
  colorByKey,
  onSelect,
}: {
  playerId: string
  playerName: string
  usage: UsageShare
  colorByKey: Map<string, string>
  onSelect: (playerId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<{ point: HoverPoint; cx: number; cy: number } | null>(null)
  const [cardStyle, setCardStyle] = useState<{ left: number; top: number }>({ left: 0, top: 0 })

  // Re-measures the card itself (its height depends on how many players are
  // tied at that point) and anchors it to the dot, defaulting to the
  // top-right and only flipping to the left when genuinely near the right
  // edge (not just past the midpoint - the card is often wider than half
  // the chart, so a plain "would this overflow" check flips left for any
  // point at or past the middle) and only flipping down when genuinely
  // near the top.
  useLayoutEffect(() => {
    if (!hovered || !cardRef.current || !containerRef.current) return
    const container = containerRef.current.getBoundingClientRect()
    const card = cardRef.current.getBoundingClientRect()
    const GAP = 14
    const nearRightEdge = hovered.cx > container.width * 0.75
    const left = nearRightEdge
      ? Math.max(hovered.cx - card.width - GAP, 8)
      : Math.min(hovered.cx + GAP, container.width - card.width - 8)
    const nearTopEdge = hovered.cy < container.height * 0.25
    const top = nearTopEdge
      ? Math.min(hovered.cy + GAP, container.height - card.height - 8)
      : Math.max(hovered.cy - card.height - GAP, 8)
    setCardStyle({ left, top })
  }, [hovered])

  // One line per teammate with a nonzero season total (usage.teammates is
  // already sorted that way - the same order buildColorByKey used, so line
  // order, legend order, and color assignment all agree), or just the
  // single "Other" line for QB TD involvement, which isn't a roster of
  // individually ranked teammates.
  const otherIds: string[] = usage.metric === "td_involvement" ? [OTHER_KEY] : usage.teammates.map((t) => t.player_id)
  const nameByKey = new Map<string, string>([[playerId, playerName]])
  for (const week of usage.weekly) {
    for (const player of week.players) {
      nameByKey.set(player.player_id ?? OTHER_KEY, player.name)
    }
  }

  const data: WeekSharePoint[] = usage.weekly.map((week) => {
    const row: WeekSharePoint = { week: `W${week.week}` }
    for (const player of week.players) {
      const key = player.player_id ?? OTHER_KEY
      row[key] = week.team_value > 0 ? (player.value / week.team_value) * 100 : 0
    }
    return row
  })
  const peak = data.reduce((best, row) => (Number(row[playerId]) > Number(best[playerId]) ? row : best))

  // Scaled to the real data rather than a fixed 0-100 - a deep pool (tackle
  // share) rarely has anyone above 20-30%, so a full 100% axis would leave
  // every line squashed into the bottom of the chart instead of using the
  // space to actually tell them apart.
  const allIds = [playerId, ...otherIds]
  const maxValue = Math.max(...data.flatMap((row) => allIds.map((key) => Number(row[key]) || 0)))
  const yMax = Math.min(100, Math.max(10, Math.ceil((maxValue * 1.15) / 10) * 10))

  // One hoverable point per (week, distinct raw value) group among the shown
  // players - two players tied on the exact same count/share that week
  // collapse into one point whose card lists both, rather than one hiding
  // behind the other.
  const hoverPoints: HoverPoint[] = usage.weekly.flatMap((week) => {
    const shown = week.players.filter((player) => allIds.includes(player.player_id ?? OTHER_KEY))
    const groups = new Map<number, UsagePlayerAmount[]>()
    for (const player of shown) {
      const list = groups.get(player.value) ?? []
      list.push(player)
      groups.set(player.value, list)
    }
    return [...groups.entries()].map(([value, members]) => ({
      week: `W${week.week}`,
      sharePct: week.team_value > 0 ? (value / week.team_value) * 100 : 0,
      members: members.map((member) => {
        const key = member.player_id ?? OTHER_KEY
        return {
          key,
          name: member.name,
          headshotUrl: member.headshot_url,
          color: colorByKey.get(key) ?? "var(--text-muted)",
          value: member.value,
          sharePct: week.team_value > 0 ? (member.value / week.team_value) * 100 : 0,
        }
      }),
    }))
  })

  return (
    <div className="p-3">
      <div className="mb-2 flex items-start justify-between gap-4 px-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
            {usage.label.split(" vs ")[0]} - Best Week
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[var(--text-primary)]">
              {Math.round(Number(peak[playerId]) || 0)}%
            </span>
            <span className="text-sm text-[var(--text-secondary)]">in {peak.week}</span>
          </div>
        </div>
        <details className="text-xs text-[var(--text-muted)]">
          <summary className="cursor-pointer text-[var(--text-secondary)]">Key</summary>
          <ul className="mt-1 grid max-h-40 gap-1 overflow-y-auto pr-1">
            {allIds.map((key) => (
              <li key={key} className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colorByKey.get(key) }}
                />
                {nameByKey.get(key) ?? key}
              </li>
            ))}
          </ul>
        </details>
      </div>
      <div ref={containerRef} className="relative">
        <ChartContainer config={chartConfig} className="aspect-[4/3]">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="week"
              allowDuplicatedCategory={false}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            />
            <YAxis
              domain={[0, yMax]}
              tickFormatter={(value: number) => `${value}%`}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              width={40}
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            />
            {otherIds.map((key) => (
              <Line
                type="monotone"
                key={key}
                dataKey={key}
                stroke={colorByKey.get(key)}
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
            <Line
              type="monotone"
              dataKey={playerId}
              stroke={colorByKey.get(playerId)}
              strokeWidth={3}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            {/* Invisible wide-stroke lines on top of the visible ones, one
                per real player (not "Other") - the actual click target, so
                the whole line is clickable, not just its discrete dots. */}
            {otherIds
              .filter((key) => key !== OTHER_KEY)
              .map((key) => (
                <Line
                  type="monotone"
                  key={`${key}-hit`}
                  dataKey={key}
                  stroke="transparent"
                  strokeWidth={12}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                  connectNulls
                  className="cursor-pointer"
                  onClick={() => onSelect(key)}
                />
              ))}
            <Line
              type="monotone"
              dataKey={playerId}
              stroke="transparent"
              strokeWidth={12}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              className="cursor-pointer"
              onClick={() => onSelect(playerId)}
            />
            <Scatter
              data={hoverPoints}
              dataKey="sharePct"
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number; payload?: HoverPoint }) => (
                <HoverDot
                  {...props}
                  focusKey={playerId}
                  onEnter={(point) =>
                    setHovered({ point, cx: props.cx ?? 0, cy: props.cy ?? 0 })
                  }
                  onLeave={() => setHovered(null)}
                  onSelect={onSelect}
                />
              )}
            />
          </ComposedChart>
        </ChartContainer>
        {hovered && (
          <div ref={cardRef} className="pointer-events-none absolute z-10" style={cardStyle}>
            <HoverCard point={hovered.point} />
          </div>
        )}
      </div>
      <p className="pt-2 text-xs text-[var(--text-muted)]">{usageCaption(usage.metric, true)}</p>
    </div>
  )
}

function TeamUsagePanel({ playerId, playerName }: { playerId: string; playerName: string }) {
  const navigate = useNavigate()
  const usage = useFetch<UsageShare>(`/players/${playerId}/usage`)
  const teams = useFetch<TeamInfo[]>("/teams")
  const [view, setView] = useState<View>("weekly")

  const loading = usage.loading || teams.loading
  const error = usage.error ?? teams.error
  const team = teams.data?.find((t) => t.team_abbr === usage.data?.team)
  const teamColor = team?.team_color ?? "var(--accent)"

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
          <UsageWeeklyChart
            playerId={playerId}
            playerName={playerName}
            usage={usage.data}
            colorByKey={buildColorByKey(usage.data, playerId)}
            onSelect={goToPlayer}
          />
        ))}
    </Panel>
  )
}

export default TeamUsagePanel
