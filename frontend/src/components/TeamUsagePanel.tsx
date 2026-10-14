// TeamUsagePanel.tsx
// "Team Usage" panel with two views, toggled at the top: a week-by-week
// line chart of this player's share of the team's touches/targets/TDs (the
// default view, so a trend - workload growing/shrinking - is what you see
// first) and a season-snapshot donut of the same split. On a touchscreen the
// weekly chart's hover card moves to a box below the chart: a tap selects a
// dot, line, or bar, and a second tap (or the box's button) opens that player.
import { useCallback, useLayoutEffect, useRef, useState } from "react"
import type * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  Rectangle,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { TeamInfo } from "../data/teams"
import {
  buildColorByKey,
  OTHER_KEY,
  type UsagePlayerAmount,
  type UsageShare,
} from "../data/usage"
import { pieSliceAt } from "../lib/pieSliceAt"
import { useFetch } from "../lib/useFetch"
import { TOUCH_QUERY, useMediaQuery } from "../lib/useMediaQuery"
import { useTapToOpen } from "../lib/useTapToOpen"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import Panel from "./Panel"
import PlayerAvatar from "./PlayerAvatar"
import PositionGroupToggle from "./PositionGroupToggle"
import { OpenButton, TapDetails } from "./TapDetails"





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
  targets_against: {
    season: "Share of the passes thrown at this team's defense that came at this player.",
    weekly: "Passes thrown at this player each week, vs. the rest of the team.",
  },
  pressures: {
    season:
      "Share of the team's quarterback pressures (sacks, hits, and hurries) this player has created this season.",
    weekly: "Quarterback pressures this player created each week, vs. the rest of the team.",
  },
}

// The captions above are written about one player. Without a focus the same
// chart is describing the whole pool, so it needs its own wording.
const TEAM_CAPTIONS: Record<string, { season: string; weekly: string }> = {
  touches: {
    season: "How this backfield's touches (carries + receptions) are split between its runners.",
    weekly: "Backfield touches (carries + receptions) each week, split between its runners.",
  },
  targets: {
    season: "How this team's targets are split between its pass catchers.",
    weekly: "Targets each week, split between this team's pass catchers.",
  },
}

function usageCaption(metric: string, weekly: boolean, focused = true): string {
  const captions = focused ? USAGE_CAPTIONS : { ...USAGE_CAPTIONS, ...TEAM_CAPTIONS }
  const caption = captions[metric] ?? captions.targets
  return weekly ? caption.weekly : caption.season
}

// Custom rather than the shared ChartTooltipContent, which assumes one
// tooltip covers a whole series - here each slice is its own player.
function UsageTooltip({ slice }: { slice: DonutSlice | null }) {
  // An empty-but-present element, not null - keeps Recharts' tooltip wrapper
  // mounted between hovers so it doesn't reset position to (0,0) and animate
  // in from the corner every time.
  if (!slice) return <span className="p-4" />
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/70 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm">
      <SliceRow slice={slice} />
    </div>
  )
}

// A slice's name and amount: the tooltip's content, and the touchscreen box's.
function SliceRow({ slice }: { slice: DonutSlice }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-medium text-[var(--text-primary)]">{slice.name}</span>
      <span className="font-mono font-medium tabular-nums text-[var(--text-primary)]">{slice.value}</span>
    </div>
  )
}

export function UsageDonut({
  playerName,
  usage,
  colorByKey,
  onSelect,
}: {
  // null on the team view: every slice is a teammate and the centre shows the
  // leader's share rather than one player's.
  playerName: string | null
  usage: UsageShare
  colorByKey: Map<string, string>
  onSelect: (playerId: string) => void
}) {
  const data: DonutSlice[] = [
    ...(playerName
      ? [
          {
            player_id: usage.player_id ?? undefined,
            name: playerName,
            value: usage.player_value,
            isPlayer: true,
          },
        ]
      : []),
    ...usage.teammates.map((teammate) => ({ ...teammate, isPlayer: false })),
  ]
  const headlineValue = playerName ? usage.player_value : (data[0]?.value ?? 0)
  const sharePct = usage.team_value > 0 ? Math.round((headlineValue / usage.team_value) * 100) : 0

  const containerRef = useRef<HTMLDivElement>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [hoveredSlice, setHoveredSlice] = useState<DonutSlice | null>(null)
  // Mousemove fires far faster than the screen repaints, and Recharts owns the
  // tooltip's position, so the state update can't be skipped - it's coalesced
  // to one per frame instead.
  const frameRef = useRef<number | null>(null)

  // Slices by index in `data`. A mouse click on a teammate's slice opens
  // their page; a tap shows the slice below the donut first (useTapToOpen).
  const touchScreen = useMediaQuery(TOUCH_QUERY)
  const tap = useTapToOpen<number>((index) => {
    const playerId = data[index]?.player_id
    if (playerId) onSelect(playerId)
  })
  const selected = tap.selected === null ? undefined : data[tap.selected]

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
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    const card = containerRef.current.querySelector<HTMLElement>(".recharts-tooltip-wrapper")
    const cardWidth = card?.offsetWidth || 150
    const cardHeight = card?.offsetHeight || 36
    const GAP = 12
    const flipLeft = x + GAP + cardWidth > rect.width
    const flipUp = y + GAP + cardHeight > rect.height
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      setCursorPos({
        x: flipLeft ? Math.max(x - GAP - cardWidth, 0) : x + GAP,
        y: flipUp ? Math.max(y - GAP - cardHeight, 0) : y + GAP,
      })
    })
  }

  return (
    <>
      <div
        ref={containerRef}
        className="relative p-3"
        onMouseMove={handleMouseMove}
        {...tap.pressHandlers(pieSliceAt)}
      >
        <ChartContainer
          config={chartConfig}
          className="aspect-[4/3]"
          label={
            playerName
              ? `${playerName}'s share of the team's ${usage.label.toLowerCase()}: ${sharePct}%.`
              : `This team's ${usage.label.toLowerCase()} this season, player by player. ${data[0]?.name ?? "Nobody"} leads with ${sharePct}%.`
          }
        >
          <PieChart>
            {/* On a touchscreen, the box below stands in for the tooltip. */}
            {!touchScreen && (
              <Tooltip
                content={<UsageTooltip slice={hoveredSlice} />}
                // Recharts animates the tooltip's *position*, so moving between
                // slices slides the card across instead of it following the
                // cursor. Off, it tracks immediately.
                isAnimationActive={false}
                animationDuration={0}
                wrapperStyle={{ zIndex: 20 }}
                position={cursorPos ?? undefined}
              />
            )}
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
              // The gaps between slices hover nothing, so the tooltip would
              // blank for a frame as the cursor crosses one. Tracking the last
              // sector entered keeps the card steady until the next takes
              // over; Recharts hides the wrapper on leave, so it can't go stale.
              // Mouse only: on a touchscreen the tap flow below owns selection,
              // and a click handler here would open a player on first tap.
              {...(!touchScreen && {
                onMouseEnter: (_: unknown, index: number) => setHoveredSlice(data[index] ?? null),
                onClick: (sector: { player_id?: string; payload?: DonutSlice }) => {
                  const playerId = sector.player_id ?? sector.payload?.player_id
                  if (playerId) onSelect(playerId)
                },
              })}
            >
              {data.map((slice, index) => (
                <Cell
                  key={slice.name}
                  fill={colorByKey.get(slice.player_id ?? "") ?? TEAMMATE_FILL}
                  // Teammates stay in the palette but recede, the same
                  // emphasis the weekly bars use. With no focus player
                  // nobody recedes.
                  fillOpacity={!playerName || slice.isPlayer ? 1 : 0.4}
                  cursor={slice.player_id ? "pointer" : "default"}
                  {...(index === tap.selected && { stroke: "var(--accent)", strokeWidth: 3 })}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-3 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold text-[var(--text-primary)]">{sharePct}%</span>
          <span className="max-w-[70%] text-center text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
            {/* Without a focus player the number is the leader's share, so it
                has to say whose - the metric name alone wouldn't. */}
            {playerName ? usage.label.split(" vs ")[0] : (data[0]?.name ?? usage.label)}
          </span>
        </div>
      </div>
      {touchScreen && (
        <div className="px-3 pb-2">
          {/* Held at a teammate's box height (74px, with its button), so taps don't shift the caption. */}
          <TapDetails prompt="Tap a slice to see its numbers." className="min-h-19">
            {selected && (
              <div className="flex flex-col gap-1.5">
                <SliceRow slice={selected} />
                {selected.player_id && <OpenButton name={selected.name} onClick={() => onSelect(selected.player_id!)} />}
              </div>
            )}
          </TapDetails>
        </div>
      )}
      <p className="px-3 pb-2 text-xs text-[var(--text-muted)]">
        {usageCaption(usage.metric, false, Boolean(playerName))}
      </p>
      <details className="px-3 pb-2 text-xs text-[var(--text-muted)]">
        <summary className="-my-1 cursor-pointer py-1 text-[var(--text-secondary)]">Legend</summary>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {data.map((slice) => (
            <li
              key={slice.name}
              className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{
                  backgroundColor: colorByKey.get(slice.player_id ?? "") ?? TEAMMATE_FILL,
                  opacity: !playerName || slice.isPlayer ? 1 : 0.4,
                }}
              />
              {slice.name}
            </li>
          ))}
        </ul>
      </details>
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

// Clicks and taps are resolved by the chart container from `data-tap-key`
// (see markAt): recharts recreates these dot nodes when hover re-renders the
// chart mid-click, so a click event never reliably arrives at all.
function HoverDot({
  cx,
  cy,
  payload,
  focusKey,
  tapKey,
  selected,
  onEnter,
  onLeave,
}: {
  cx?: number
  cy?: number
  payload?: HoverPoint
  focusKey: string | null
  tapKey: string
  // Picked by a tap: ringed in the accent color.
  selected: boolean
  onEnter: (point: HoverPoint) => void
  onLeave: () => void
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
      data-tap-key={tapKey}
      onMouseEnter={() => onEnter(payload)}
      onMouseLeave={onLeave}
      className={clickable ? "cursor-pointer" : undefined}
    >
      <circle cx={cx} cy={cy} r={HOVER_HIT_RADIUS} fill="transparent" />
      {selected && <circle cx={cx} cy={cy} r={radius + 3.5} fill="none" stroke="var(--accent)" strokeWidth={2} />}
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
    <div className="grid w-max max-w-56 gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/90 px-2 py-1.5 text-xs shadow-xl backdrop-blur-sm">
      <PointRows point={point} />
    </div>
  )
}

// The week and each player at a point: the hover card's content, and the
// touchscreen details box's.
function PointRows({ point }: { point: HoverPoint }) {
  return (
    <div className="grid gap-1">
      <div className="font-medium text-[var(--text-primary)]">{point.week}</div>
      {point.members.map((member) => (
        <div key={member.key} className="flex items-center gap-2">
          {/* The "everyone else" bucket is a group, not a person - anything
              in the headshot slot there reads as a teammate's missing photo,
              so it gets the legend's small color dot instead. */}
          {member.key === OTHER_KEY ? (
            <span
              className="mx-2 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: member.color }}
            />
          ) : (
            <PlayerAvatar
              name={member.name}
              headshot={member.headshotUrl}
              color={member.color}
              size="h-6 w-6"
              imageSize={64}
            />
          )}
          <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{member.name}</span>
          <span className="shrink-0 font-mono font-medium tabular-nums text-[var(--text-primary)]">
            {member.value} ({Math.round(member.sharePct)}%)
          </span>
        </div>
      ))}
    </div>
  )
}

// A tapped line: the player and their share each week.
function LineRows({ name, shares }: { name: string; shares: [string, number][] }) {
  return (
    <div className="grid gap-1">
      <div className="font-medium text-[var(--text-primary)]">{name}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[var(--text-secondary)]">
        {shares.map(([week, share]) => (
          <span key={week}>
            {week} <span className="font-mono tabular-nums text-[var(--text-primary)]">{Math.round(share)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function UsageWeeklyChart({
  playerId,
  playerName,
  usage,
  colorByKey,
  onSelect,
}: {
  // Both null on the team view: no line is thickened and no week is headlined.
  playerId: string | null
  playerName: string | null
  usage: UsageShare
  colorByKey: Map<string, string>
  onSelect: (playerId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<{ point: HoverPoint; cx: number; cy: number } | null>(null)

  // Writes straight to the node instead of going through state: the bar
  // chart repositions this on every mousemove, and re-rendering the whole
  // chart at that rate is what makes it feel laggy.
  //
  // Re-measures the card itself (its height depends on how many players are
  // tied at that point) and anchors it to the dot, defaulting to the
  // top-right and only flipping to the left when genuinely near the right
  // edge (not just past the midpoint - the card is often wider than half
  // the chart, so a plain "would this overflow" check flips left for any
  // point at or past the middle) and only flipping down when genuinely
  // near the top.
  const placeCard = useCallback((cx: number, cy: number) => {
    if (!cardRef.current || !containerRef.current) return
    const container = containerRef.current.getBoundingClientRect()
    const card = cardRef.current.getBoundingClientRect()
    const GAP = 14
    const nearRightEdge = cx > container.width * 0.75
    const left = nearRightEdge
      ? Math.max(cx - card.width - GAP, 8)
      : Math.min(cx + GAP, container.width - card.width - 8)
    const nearTopEdge = cy < container.height * 0.25
    const top = nearTopEdge
      ? Math.min(cy + GAP, container.height - card.height - 8)
      : Math.max(cy - card.height - GAP, 8)
    cardRef.current.style.left = `${left}px`
    cardRef.current.style.top = `${top}px`
  }, [])

  useLayoutEffect(() => {
    if (hovered) placeCard(hovered.cx, hovered.cy)
  }, [hovered, placeCard])

  // One line per teammate with a nonzero season total (usage.teammates is
  // already sorted that way - the same order buildColorByKey used, so line
  // order, legend order, and color assignment all agree), or just the
  // single "Other" line for QB TD involvement, which isn't a roster of
  // individually ranked teammates.
  const otherIds: string[] = usage.metric === "td_involvement" ? [OTHER_KEY] : usage.teammates.map((t) => t.player_id)
  const nameByKey = new Map<string, string>(playerId && playerName ? [[playerId, playerName]] : [])
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
  const peak = playerId
    ? data.reduce((best, row) => (Number(row[playerId]) > Number(best[playerId]) ? row : best))
    : null

  // A QB's best week is almost always 100% - most starters have some week
  // they had a hand in every touchdown their team scored - so the peak says
  // nothing about one QB vs. another. The per-game rate does.
  const isTdInvolvement = usage.metric === "td_involvement"
  const perGame = usage.weekly.length > 0 ? usage.player_value / usage.weekly.length : 0
  const stacked = usage.metric !== "td_involvement" && usage.metric !== "touches"

  // Scaled to the real data rather than a fixed 0-100 - a deep pool (tackle
  // share) rarely has anyone above 20-30%, so a full 100% axis would leave
  // every line squashed into the bottom of the chart instead of using the
  // space to actually tell them apart.
  const allIds = playerId ? [playerId, ...otherIds] : otherIds
  const maxValue = Math.max(...data.flatMap((row) => allIds.map((key) => Number(row[key]) || 0)))
  const yMax = Math.min(100, Math.max(10, Math.ceil((maxValue * 1.15) / 10) * 10))

  const stackIds = [
    ...(playerId ? [{ id: playerId, value: usage.player_value }] : []),
    ...usage.teammates.map((teammate) => ({ id: teammate.player_id, value: teammate.value })),
  ]
    .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id))
    .map((entry) => entry.id)

  // Each week orders its own stack, biggest at the bottom. Recharts stacks in
  // the order the <Bar>s are declared, which is global, so the bars are
  // positional slots ("the week's 1st biggest", "2nd biggest", ...) and the
  // player each slot holds - and therefore its color - changes per week.
  const slotPlayers = new Map(
    usage.weekly.map((week) => [
      `W${week.week}`,
      week.players
        .filter((player) => allIds.includes(player.player_id ?? OTHER_KEY))
        .sort(
          (a, b) =>
            b.value - a.value || (a.player_id ?? OTHER_KEY).localeCompare(b.player_id ?? OTHER_KEY),
        )
        .map((player) => player.player_id ?? OTHER_KEY),
    ]),
  )
  const slots = Math.max(...[...slotPlayers.values()].map((keys) => keys.length))
  const slotData = usage.weekly.map((week) => {
    const label = `W${week.week}`
    const row: WeekSharePoint = { week: label }
    slotPlayers.get(label)?.forEach((key, slot) => {
      row[`slot${slot}`] = Number(data.find((entry) => entry.week === label)?.[key]) || 0
    })
    return row
  })

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

  // Bar segments are hovered individually, so they skip the tie-grouping the
  // line chart's points need and look their one player up directly.
  const memberByWeekKey = new Map(
    hoverPoints.flatMap((point) => point.members.map((member) => [`${point.week}|${member.key}`, member])),
  )

  // Every tappable mark has a key: a dot "dot:<index in hoverPoints>", a bar
  // segment "bar:<week>|<player>", or a whole line "line:<player>". A mouse
  // click opens the player at once; a tap selects the mark first (see useTapToOpen).
  const touchScreen = useMediaQuery(TOUCH_QUERY)
  function playerFor(key: string): string | null {
    if (key.startsWith("line:")) return key.slice("line:".length)
    if (key.startsWith("bar:")) return key.split("|")[1] ?? null
    const point = hoverPoints[Number(key.slice("dot:".length))]
    return point?.members.length === 1 ? point.members[0].key : null
  }
  const tap = useTapToOpen<string>((key) => {
    const player = playerFor(key)
    if (player && player !== OTHER_KEY) onSelect(player)
  })

  // The mark under a press, read off the DOM rather than the event's target:
  // hovering re-renders the chart and recharts recreates its marks mid-press.
  function markAt(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY)
    const tagged = el?.closest("[data-tap-key]")
    if (tagged) return tagged.getAttribute("data-tap-key")
    if (el?.classList.contains("recharts-line-curve") && el.getAttribute("stroke") === "transparent") {
      return el.getAttribute("name")
    }
    return null
  }

  // What the touchscreen box shows for the selected mark.
  const selectedKey = tap.selected
  const selectedPlayer = selectedKey && playerFor(selectedKey)
  const selectedPoint: HoverPoint | undefined = !selectedKey
    ? undefined
    : selectedKey.startsWith("dot:")
      ? hoverPoints[Number(selectedKey.slice("dot:".length))]
      : selectedKey.startsWith("bar:")
        ? (() => {
            const [week, key] = selectedKey.slice("bar:".length).split("|")
            const member = memberByWeekKey.get(`${week}|${key}`)
            return member && { week, sharePct: member.sharePct, members: [member] }
          })()
        : undefined

  return (
    <div className="p-3">
      {playerId && peak && (
        <div className="mb-2 flex items-start justify-between gap-4 px-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
              {isTdInvolvement ? "TD Involvements - Average" : `${usage.label.split(" vs ")[0]} - Best Week`}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-[var(--text-primary)]">
                {isTdInvolvement ? perGame.toFixed(1) : `${Math.round(Number(peak[playerId]) || 0)}%`}
              </span>
              <span className="text-sm text-[var(--text-secondary)]">
                {isTdInvolvement ? "per game" : `in ${peak.week}`}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* A bar segment is an area, not a point, so its card tracks the cursor
          rather than pinning to one spot the way the line chart's dots do. */}
      <div
        ref={containerRef}
        className="relative"
        // On pointerup, not click: a tap's emulated mouseover re-renders the
        // chart (hover state), and recharts replaces the mark's node between
        // mousedown and mouseup, so the browser never fires the click.
        {...tap.pressHandlers(markAt)}
        onMouseMove={
          stacked
            ? (event) => {
                const rect = containerRef.current?.getBoundingClientRect()
                if (!rect) return
                // Recharts' own mouseleave doesn't fire between abutting
                // segments, so the card would otherwise trail the cursor out
                // over empty chart space.
                if (!(event.target as Element).closest(".recharts-bar-rectangle")) {
                  setHovered(null)
                  return
                }
                placeCard(event.clientX - rect.left, event.clientY - rect.top)
              }
            : undefined
        }
      >
        <ChartContainer
          config={chartConfig}
          className="aspect-[4/3]"
          label={
            playerName
              ? `${playerName}'s share of the team's ${usage.label.toLowerCase()}, week by week.`
              : `This team's ${usage.label.toLowerCase()} week by week, player by player.`
          }
        >
          <ComposedChart data={stacked ? slotData : data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="week"
              allowDuplicatedCategory={false}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            />
            <YAxis
              domain={stacked ? [0, 100] : [0, yMax]}
              ticks={stacked ? [0, 25, 50, 75, 100] : undefined}
              allowDecimals={false}
              tickFormatter={(value: number) => `${Math.round(value)}%`}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              width={40}
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            />
            {stacked &&
              Array.from({ length: slots }, (_, slot) => (
                <Bar
                  key={slot}
                  dataKey={`slot${slot}`}
                  stackId="usage"
                  stroke="var(--surface-1)"
                  strokeWidth={1}
                  radius={3}
                  maxBarSize={40}
                  isAnimationActive={false}
                  className="cursor-pointer"
                  onMouseEnter={(bar: { x?: number; y?: number; width?: number; payload?: WeekSharePoint }) => {
                    const week = String(bar.payload?.week)
                    const key = slotPlayers.get(week)?.[slot]
                    const member = key && memberByWeekKey.get(`${week}|${key}`)
                    if (!member) return
                    setHovered({
                      point: { week, sharePct: member.sharePct, members: [member] },
                      cx: (bar.x ?? 0) + (bar.width ?? 0) / 2,
                      cy: bar.y ?? 0,
                    })
                  }}
                  onMouseLeave={() => setHovered(null)}
                  shape={(bar: React.ComponentProps<typeof Rectangle> & { payload?: WeekSharePoint }) => {
                    const week = String(bar.payload?.week)
                    const key = slotPlayers.get(week)?.[slot]
                    if (!key) return <Rectangle {...bar} />
                    const tapKey = `bar:${week}|${key}`
                    return (
                      <g data-tap-key={tapKey}>
                        <Rectangle
                          {...bar}
                          {...(tapKey === tap.selected && { stroke: "var(--accent)", strokeWidth: 2.5 })}
                        />
                      </g>
                    )
                  }}
                >
                  {slotData.map((row) => {
                    const key = slotPlayers.get(String(row.week))?.[slot]
                    return (
                      <Cell
                        key={String(row.week)}
                        fill={key ? colorByKey.get(key) : "transparent"}
                        fillOpacity={!playerId || key === playerId ? 1 : 0.4}
                      />
                    )
                  })}
                </Bar>
              ))}
            {!stacked && otherIds.map((key) => (
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
            {!stacked && playerId && (
              <Line
                type="monotone"
                dataKey={playerId}
                stroke={colorByKey.get(playerId)}
                strokeWidth={3}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
            {/* Invisible wide-stroke lines on top of the visible ones, one
                per real player (not "Other") - the actual click target, so
                the whole line is clickable, not just its discrete dots. */}
            {!stacked && otherIds
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
                  name={`line:${key}`}
                />
              ))}
            {!stacked && playerId && (
              <Line
                type="monotone"
                dataKey={playerId}
                stroke="transparent"
                strokeWidth={12}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                className="cursor-pointer"
                name={`line:${playerId}`}
              />
            )}
            {!stacked && (
              <Scatter
                data={hoverPoints}
                dataKey="sharePct"
                isAnimationActive={false}
                shape={(props: { cx?: number; cy?: number; payload?: HoverPoint; index?: number }) => (
                  <HoverDot
                    cx={props.cx}
                    cy={props.cy}
                    payload={props.payload}
                    focusKey={playerId}
                    tapKey={`dot:${props.index}`}
                    selected={`dot:${props.index}` === tap.selected}
                    onEnter={(point) =>
                      setHovered({ point, cx: props.cx ?? 0, cy: props.cy ?? 0 })
                    }
                    onLeave={() => setHovered(null)}
                  />
                )}
              />
            )}
          </ComposedChart>
        </ChartContainer>
        {/* On a touchscreen, the details box below stands in for this card. */}
        {hovered && !touchScreen && (
          <div ref={cardRef} className="pointer-events-none absolute z-10">
            <HoverCard point={hovered.point} />
          </div>
        )}
      </div>
      {touchScreen && (
        <TapDetails
          prompt={stacked ? "Tap a bar to see that week's numbers." : "Tap a dot or line to see the numbers."}
          className="min-h-32"
        >
          {selectedKey && (
            <div className="flex flex-col gap-1.5">
              {selectedPoint ? (
                <PointRows point={selectedPoint} />
              ) : (
                selectedPlayer && <LineRows name={nameByKey.get(selectedPlayer) ?? selectedPlayer} shares={data.map((row) => [row.week, Number(row[selectedPlayer]) || 0])} />
              )}
              {selectedPlayer && selectedPlayer !== OTHER_KEY && selectedPlayer !== playerId && (
                <OpenButton name={nameByKey.get(selectedPlayer) ?? "player"} onClick={() => onSelect(selectedPlayer)} />
              )}
            </div>
          )}
        </TapDetails>
      )}
      <p className="pt-2 text-xs text-[var(--text-muted)]">
        {usageCaption(usage.metric, true, Boolean(playerId))}
        {(usage.metric === "pressures" || usage.metric === "targets_against") &&
          " This comes from Pro Football Reference, which can take a day or two to post the most recent week."}
      </p>
      <details className="px-3 pt-2 pb-1 text-xs text-[var(--text-muted)]">
        <summary className="-my-1 cursor-pointer py-1 text-[var(--text-secondary)]">Legend</summary>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {(stacked ? stackIds : allIds).map((key) => (
            <li key={key} className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: colorByKey.get(key) }}
              />
              {nameByKey.get(key) ?? key}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function TeamUsagePanel({ playerId, playerName }: { playerId: string; playerName: string }) {
  const navigate = useNavigate()
  const usage = useFetch<UsageShare>(`/players/${encodeURIComponent(playerId)}/usage`)
  const teams = useFetch<TeamInfo[]>("/teams")
  const [view, setView] = useState<View>("weekly")

  const loading = usage.loading || teams.loading
  const error = usage.error ?? teams.error
  const team = teams.data?.find((t) => t.team_abbr === usage.data?.team)
  const teamColor = team?.team_color ?? "var(--accent)"
  const teamColor2 = team?.team_color2 ?? "var(--border)"

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
            usage={usage.data}
            colorByKey={buildColorByKey(usage.data, playerId, teamColor, teamColor2)}
            onSelect={goToPlayer}
          />
        ) : (
          <UsageWeeklyChart
            playerId={playerId}
            playerName={playerName}
            usage={usage.data}
            colorByKey={buildColorByKey(usage.data, playerId, teamColor, teamColor2)}
            onSelect={goToPlayer}
          />
        ))}
    </Panel>
  )
}

export default TeamUsagePanel
