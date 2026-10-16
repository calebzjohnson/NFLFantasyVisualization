// TeamTendenciesPanel.tsx
// How a team calls plays, as 100% split bars: the team's own split, and the
// league's beneath it for comparison. Rank is placement, not judgement -
// throwing often is neither better nor worse than running often.
import { useState } from "react"
import { ordinal } from "../data/efficiency"
import { toBars, type Segment, type Tendency, type TendencyBar } from "../data/tendencies"
import { useFetch } from "../lib/useFetch"
import { TOUCH_QUERY, useMediaQuery } from "../lib/useMediaQuery"
import Panel from "./Panel"

// First two steps of the categorical palette, validated for colorblind
// separation against this surface.
const SEGMENT_FILL = ["#2a78d6", "#eb6834"]
const LEAGUE_OPACITY = 0.45

function Bar({
  segments,
  league,
  active,
}: {
  segments: readonly [Segment, Segment]
  league: boolean
  active: boolean
}) {
  const detail = segments
    .map((seg) => `${seg.label} ${value(seg, league)}%${league ? "" : ` (${ordinal(seg.rank)})`}`)
    .join(" · ")

  return (
    <div
      // Native title rather than a tooltip component: hover only has to repeat
      // what the row already says, and this works on the whole bar at once.
      title={detail}
      className={`flex h-3 gap-0.5 overflow-hidden rounded-full ring-[var(--accent)] transition-shadow ${
        active ? "ring-2" : ""
      }`}
      aria-hidden="true"
    >
      {segments.map((segment, index) => (
        <div
          key={segment.label}
          style={{
            width: `${value(segment, league)}%`,
            backgroundColor: SEGMENT_FILL[index],
            opacity: league ? LEAGUE_OPACITY : 1,
          }}
          className="first:rounded-l-full last:rounded-r-full"
        />
      ))}
    </div>
  )
}

function value(segment: Segment, league: boolean) {
  return league ? segment.leagueAverage : segment.value
}

function BarRow({ bar }: { bar: TendencyBar }) {
  // Pointing at a bar - by hover on a mouse, by tap on a phone - rings it and
  // bolds that row's own numbers.
  const [active, setActive] = useState<"team" | "league" | null>(null)
  // A tap synthesizes mouseenter, click, then mouseleave, so hover handlers
  // would clear the selection the tap just made. Touchscreens use the tap.
  const touchScreen = useMediaQuery(TOUCH_QUERY)
  const [first, second] = bar.segments
  const label =
    `${bar.title}. ${first.label} ${first.value}%, ${ordinal(first.rank)} of ${bar.teams}. ` +
    `${second.label} ${second.value}%, ${ordinal(second.rank)}. ` +
    `League ${first.leagueAverage}% and ${second.leagueAverage}%.`

  return (
    <div role="figure" aria-label={label} className="flex flex-col gap-1.5 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
        {bar.segments.map((segment, index) => (
          <span key={segment.label} className="flex items-baseline gap-1.5">
            <span
              className="h-2 w-2 shrink-0 translate-y-px rounded-[2px]"
              style={{ backgroundColor: SEGMENT_FILL[index] }}
            />
            <span className="tracking-wider text-[var(--text-muted)] uppercase">{segment.label}</span>
            <span
              className={`font-mono tabular-nums text-[var(--text-primary)] ${
                active === "team" ? "font-bold" : ""
              }`}
            >
              {segment.value}
            </span>
            <span
              className={`text-[var(--text-secondary)] ${active === "team" ? "font-bold" : ""}`}
            >
              {ordinal(segment.rank)}
            </span>
          </span>
        ))}
      </div>
      <div className="flex flex-col">
        {([false, true] as const).map((league) => {
          const row = league ? "league" : "team"
          return (
            <button
              key={row}
              type="button"
              {...(touchScreen
                ? { onClick: () => setActive((current) => (current === row ? null : row)) }
                : {
                    onMouseEnter: () => setActive(row),
                    onMouseLeave: () => setActive(null),
                    onFocus: () => setActive(row),
                    onBlur: () => setActive(null),
                  })}
              aria-pressed={active === row}
              aria-label={`Highlight ${bar.title} ${league ? "league average" : "team"}`}
              // py-[5px]: the bar is 12px tall and a finger needs 24.
              className="flex w-full items-center gap-2 py-[5px]"
            >
              <span className="w-12 shrink-0 text-left text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
                {league ? "League" : "Team"}
              </span>
              <div className="min-w-0 flex-1">
                <Bar segments={bar.segments} league={league} active={active === row} />
              </div>
              <span
                className={`w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--text-muted)] ${
                  active === "league" ? "font-bold" : ""
                }`}
              >
                {league ? `${first.leagueAverage} / ${second.leagueAverage}` : ""}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const COLUMNS = 2

interface Group {
  name: string
  bars: TendencyBar[]
}

/** Groups in payload order, packed two bars to a row, so the five groups
 * holding a single bar pair up instead of each leaving half a row empty.
 */
function rowsOf(bars: TendencyBar[]): Group[][] {
  const groups = new Map<string, TendencyBar[]>()
  for (const bar of bars) {
    const rows = groups.get(bar.group) ?? []
    rows.push(bar)
    groups.set(bar.group, rows)
  }

  const packed: Group[][] = []
  let row: Group[] = []
  let width = 0
  for (const [name, groupBars] of groups) {
    if (width > 0 && width + groupBars.length > COLUMNS) {
      packed.push(row)
      row = []
      width = 0
    }
    row.push({ name, bars: groupBars })
    width += groupBars.length
  }
  if (row.length > 0) packed.push(row)
  return packed
}

function TeamTendenciesPanel({ teamAbbr }: { teamAbbr: string }) {
  const tendencies = useFetch<{ tendencies: Tendency[] }>(`/teams/${teamAbbr}/tendencies`)

  return (
    <Panel title="Play Calling">
      {tendencies.loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {tendencies.error && (
        <p className="p-4 text-sm text-[var(--negative)]">
          Couldn't load play calling: {tendencies.error}
        </p>
      )}
      {tendencies.data && (
        <>
          {rowsOf(toBars(tendencies.data.tendencies)).map((groups) => (
            <div
              key={groups.map((group) => group.name).join()}
              className="flex flex-col border-t border-[var(--border)] lg:flex-row"
            >
              {groups.map((group, index) => (
                <div
                  key={group.name}
                  style={{ flexGrow: group.bars.length }}
                  className={`min-w-0 basis-0 ${index > 0 ? "lg:border-l lg:border-[var(--border)]" : ""}`}
                >
                  <h3 className="bg-[var(--surface-2)] px-4 py-1.5 font-display text-sm font-bold tracking-wider text-[var(--text-secondary)] uppercase">
                    {group.name}
                  </h3>
                  <div className={`grid grid-cols-1 ${group.bars.length > 1 ? "lg:grid-cols-2" : ""}`}>
                    {group.bars.map((bar) => (
                      <BarRow key={bar.key} bar={bar} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <p className="px-4 py-3 text-xs text-[var(--text-muted)]">
            Share of this team's own run and pass plays this regular season, kneels and spikes
            excluded. Each share carries this team's rank among the 32 in it.
          </p>
        </>
      )}
    </Panel>
  )
}

export default TeamTendenciesPanel
