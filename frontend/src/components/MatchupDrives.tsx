// MatchupDrives.tsx
// How each team's drives ended, as flows from the team to the outcome: the
// thickness of a band is how many drives ended that way, so a team that
// punted all night has one fat band. Scoring outcomes are ordered to the top.
// The list behind the toggle is the same drives in game order, for anyone who
// wants the sequence rather than the totals.
import { useState } from "react"
import { Layer, Rectangle, Sankey, Tooltip } from "recharts"
import type { NodeProps } from "recharts/types/chart/Sankey"
import {
  driveScored,
  driveTurnover,
  drivesByTeam,
  drivesToSankey,
  type Drive,
  type Matchup,
} from "../data/matchups"
import { contrastingPair } from "../data/teamColors"
import type { TeamInfo } from "../data/teams"
import ChartDataTable from "./ChartDataTable"
import { ChartContainer } from "./evilcharts/ui/recharts-chart"
import Panel from "./Panel"

// --negative is a crimson tuned for text contrast; at chart scale it reads
// pink, so a drive outcome takes a truer red. Red against the scoring green
// is a poor pair for deuteranopes, which is why every node and every drive
// row carries its outcome in words beside the colour.
const TURNOVER_FILL = "#b3261e"
const SCORING_FILL = "var(--positive)"
const NEUTRAL_FILL = "#8a8f98"

const NODE_WIDTH = 12
const NODE_PADDING = 18

// Recharts types a Sankey node's payload as its own SankeyNode, so the
// fields put on it in drivesToSankey come back untyped.
type NodePayload = {
  name?: string
  team?: string | null
  scored?: boolean
  turnover?: boolean
  value?: number
}

function node(colors: [string, string], teams: string[]) {
  return function SankeyNode({ x, y, width, height, payload }: NodeProps) {
    const node = payload as unknown as NodePayload
    const teamIndex = node.team ? teams.indexOf(node.team) : -1
    const fill =
      teamIndex >= 0
        ? colors[teamIndex]
        : node.turnover
          ? TURNOVER_FILL
          : node.scored
            ? SCORING_FILL
            : NEUTRAL_FILL
    // Both labels sit in the chart's margins, outside the bands: the team
    // reads to the left of its node, each outcome to the right of its own.
    // Labelling inward would put the text on top of the flows.
    const isTeam = teamIndex >= 0
    return (
      <Layer>
        <Rectangle x={x} y={y} width={width} height={height} fill={fill} />
        <text
          x={isTeam ? x - 8 : x + width + 8}
          y={y + height / 2}
          textAnchor={isTeam ? "end" : "start"}
          dominantBaseline="middle"
          className="fill-[var(--text-primary)] text-[11px]"
        >
          {node.name}
        </text>
        <text
          x={isTeam ? x - 8 : x + width + 8}
          y={y + height / 2 + 13}
          textAnchor={isTeam ? "end" : "start"}
          dominantBaseline="middle"
          className="fill-[var(--text-muted)] text-[10px]"
        >
          {node.value} {node.value === 1 ? "drive" : "drives"}
        </text>
      </Layer>
    )
  }
}

// One diagram a team: that team on the left, each way its drives ended on
// the right, the band as thick as the number of drives.
function TeamFlow({
  team,
  drives,
  color,
}: {
  team: string
  drives: Drive[]
  color: string
}) {
  const flows = drivesToSankey(drives, [team])
  if (flows.links.length === 0) {
    return <p className="px-4 py-3 text-sm text-[var(--text-secondary)]">No drives recorded.</p>
  }

  return (
    <div className="px-4 py-3">
      <ChartContainer
        config={{}}
        className="aspect-[4/3] sm:aspect-[3/2]"
        label={`How ${team}'s drives ended, each band as thick as the number of drives that ended that way.`}
      >
        <Sankey
          data={flows}
          nodeWidth={NODE_WIDTH}
          nodePadding={NODE_PADDING}
          margin={{ top: 12, right: 112, bottom: 12, left: 52 }}
          link={{
            stroke: color,
            strokeOpacity: 0.2,
            fill: color,
            fillOpacity: 0.22,
          }}
          node={node([color, color], [team])}
        >
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
            }}
          />
        </Sankey>
      </ChartContainer>
      <ChartDataTable
        caption={`${team} drives by outcome`}
        columns={["Outcome", "Drives"]}
        rows={flows.links.map((link) => [flows.nodes[link.target].name, link.value])}
      />
    </div>
  )
}

function DriveList({ team, drives }: { team: string; drives: Drive[] }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <h3 className="font-display text-sm font-bold tracking-wider text-[var(--text-secondary)] uppercase">
        {team}
      </h3>
      {drives.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">No drives recorded.</p>
      )}
      {drives.map((drive) => (
        <div key={drive.drive} className="flex items-baseline gap-2 text-sm">
          <span className="w-6 shrink-0 text-xs text-[var(--text-muted)]">Q{drive.quarter}</span>
          <span
            className="h-2 w-2 shrink-0 translate-y-px rounded-full"
            style={{
              backgroundColor: driveTurnover(drive)
                ? TURNOVER_FILL
                : driveScored(drive)
                  ? SCORING_FILL
                  : "var(--border)",
            }}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
            {drive.result ?? "—"}
          </span>
          <span className="shrink-0 font-display text-sm tabular-nums text-[var(--text-muted)]">
            {drive.plays} {drive.plays === 1 ? "play" : "plays"}, {drive.yards}{" "}
            {Math.abs(drive.yards) === 1 ? "yard" : "yards"}
          </span>
        </div>
      ))}
    </div>
  )
}

function MatchupDrives({ matchup, teams }: { matchup: Matchup; teams: TeamInfo[] }) {
  const [asList, setAsList] = useState(false)
  const sides = (matchup.breakdown?.teams ?? []).map((team) => team.team)
  const drives = matchup.breakdown?.drives ?? []
  if (sides.length === 0) return null

  const colors = contrastingPair(teams, sides[0], sides[1] ?? sides[0])
  const byTeam = drivesByTeam(drives, sides)
  const flows = drivesToSankey(drives, sides)
  const drawable = flows.links.length > 0

  return (
    <Panel
      title="Drives"
      actions={
        <button
          type="button"
          onClick={() => setAsList((list) => !list)}
          aria-pressed={asList}
          className="rounded border border-[var(--border)] px-2.5 py-1 text-xs tracking-wider text-[var(--text-secondary)] uppercase hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
        >
          {asList ? "Show chart" : "Show list"}
        </button>
      }
    >
      {!asList && drawable && (
        <div className="grid grid-cols-1 divide-y divide-[var(--border)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {sides.map((team, index) => (
            <TeamFlow key={team} team={team} drives={byTeam[team] ?? []} color={colors[index]} />
          ))}
        </div>
      )}
      {!asList && !drawable && (
        <p className="p-4 text-sm text-[var(--text-secondary)]">No drives recorded.</p>
      )}
      {asList && (
        <div className="grid grid-cols-1 divide-y divide-[var(--border)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {sides.map((team) => (
            <DriveList key={team} team={team} drives={byTeam[team] ?? []} />
          ))}
        </div>
      )}
    </Panel>
  )
}

export default MatchupDrives
