// MatchupComparison.tsx
// The two teams' box score as bars rather than a column of numbers, in each
// team's own colour. Additive stats (yards, first downs, time of possession)
// are one split bar: the share is the story. Rates and EPA are drawn against
// a common scale instead, since a share of a rate means nothing and EPA goes
// negative. Opens on the gist; expanding adds the rest.
import { useState } from "react"
import {
  COMPARISON_ROWS,
  gistRows,
  shareOf,
  thirdDowns,
  type ComparisonRow,
  type GameTeam,
} from "../data/matchups"
import { contrastingPair } from "../data/teamColors"
import type { TeamInfo } from "../data/teams"
import ExpandButton from "./ExpandButton"
import Modal from "./Modal"
import Panel from "./Panel"

function valueText(row: ComparisonRow, team: GameTeam): string {
  if (row.key === "third_downs") return thirdDowns(team)
  return row.format(row.value(team))
}

function Row({
  row,
  teams,
  colors,
}: {
  row: ComparisonRow
  teams: [GameTeam, GameTeam]
  colors: [string, string]
}) {
  const [away, home] = teams
  const values = [row.value(away), row.value(home)] as const
  const missing = values[0] === null && values[1] === null

  return (
    <div className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-3 px-4 py-2 sm:grid-cols-[5.5rem_1fr_5.5rem]">
      <span className="text-left font-display text-base tabular-nums text-[var(--text-primary)]">
        {valueText(row, away)}
      </span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-center text-[11px] tracking-wider text-[var(--text-muted)] uppercase">
          {row.label}
        </span>
        {missing ? (
          <div className="h-2 w-full rounded-full bg-[var(--surface-2)]" aria-hidden="true" />
        ) : (
          <SplitBar share={shareOf(values[0], values[1], row.floor)} colors={colors} />
        )}
      </div>
      <span className="text-right font-display text-base tabular-nums text-[var(--text-primary)]">
        {valueText(row, home)}
      </span>
    </div>
  )
}

function SplitBar({ share, colors }: { share: number; colors: [string, string] }) {
  // A side with none of the bar is left out rather than drawn at zero width:
  // the 2px gap between the two would still take its space, so the bar would
  // stop short of the track and the surviving side would end square.
  const sides = [share, 100 - share]
    .map((width, index) => ({ width, color: colors[index] }))
    .filter((side) => side.width > 0)

  return (
    <div className="flex h-2 w-full gap-0.5 rounded-full" aria-hidden="true">
      {sides.map((side) => (
        <div
          key={side.color}
          style={{ width: `${side.width}%`, backgroundColor: side.color }}
          className="first:rounded-l-full last:rounded-r-full"
        />
      ))}
    </div>
  )
}

function Group({
  name,
  rows,
  teams,
  colors,
}: {
  name: string
  rows: ComparisonRow[]
  teams: [GameTeam, GameTeam]
  colors: [string, string]
}) {
  if (rows.length === 0) return null
  return (
    <div>
      <h3 className="bg-[var(--surface-2)] px-4 py-1.5 font-display text-xs font-bold tracking-wider text-[var(--text-secondary)] uppercase">
        {name}
      </h3>
      {rows.map((row) => (
        <Row key={row.key} row={row} teams={teams} colors={colors} />
      ))}
    </div>
  )
}

function Legend({ pair, colors }: { pair: [GameTeam, GameTeam]; colors: [string, string] }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2">
      {pair.map((team, index) => (
        <span
          key={team.team}
          className={`flex items-center gap-2 font-display text-sm font-bold tracking-wider uppercase ${
            index === 1 ? "flex-row-reverse" : ""
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: colors[index] }} />
          {team.team}
        </span>
      ))}
    </div>
  )
}

// Expanded, the rows are organised into their groups under headings. The
// short view is a plain list in its own order, so it isn't bound to the
// groups' ordering.
function Grouped({
  rows,
  pair,
  colors,
}: {
  rows: ComparisonRow[]
  pair: [GameTeam, GameTeam]
  colors: [string, string]
}) {
  const groups = [...new Set(rows.map((row) => row.group))]
  return (
    <>
      {groups.map((group) => (
        <Group
          key={group}
          name={group}
          rows={rows.filter((row) => row.group === group)}
          teams={pair}
          colors={colors}
        />
      ))}
    </>
  )
}

function MatchupComparison({
  sides,
  teams,
  title = "Team Comparison",
  caption,
}: {
  sides: GameTeam[]
  teams: TeamInfo[]
  title?: string
  caption?: string
}) {
  const [expanded, setExpanded] = useState(false)
  if (sides.length < 2) return null
  const pair: [GameTeam, GameTeam] = [sides[0], sides[1]]
  const colors = contrastingPair(teams, pair[0].team, pair[1].team)
  const gist = gistRows()

  return (
    <>
      <Panel
        title={title}
        className="h-full"
        actions={
          <ExpandButton
            label="Show every team stat"
            expanded={expanded}
            onClick={() => setExpanded(true)}
          />
        }
      >
        <Legend pair={pair} colors={colors} />
        {gist.map((row) => (
          <Row key={row.key} row={row} teams={pair} colors={colors} />
        ))}
        {caption && (
          <p className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-muted)]">
            {caption}
          </p>
        )}
      </Panel>
      {expanded && (
        <Modal title={title} width="max-w-xl" onClose={() => setExpanded(false)}>
          <Legend pair={pair} colors={colors} />
          <Grouped rows={COMPARISON_ROWS} pair={pair} colors={colors} />
        </Modal>
      )}
    </>
  )
}

export default MatchupComparison
