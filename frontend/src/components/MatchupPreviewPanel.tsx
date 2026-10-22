// MatchupPreviewPanel.tsx
// The setting for a game that hasn't kicked off: who's playing it and
// where, then the one thing a preview can say that a season table can't -
// where it's played, and the one thing a preview can say that a season table
// can't - each team's offense measured against the defense it's about to
// face, split into pass and run because that's where a mismatch shows.
import { edgesFor, formatEpa, shareOf, type Matchup, type PreviewTeam } from "../data/matchups"
import { contrastingPair } from "../data/teamColors"
import type { TeamInfo } from "../data/teams"
import Panel from "./Panel"

function Edge({
  label,
  offense,
  defense,
  colors,
}: {
  label: string
  offense: { team: string; value: number | null }
  defense: { team: string; value: number | null }
  colors: [string, string]
}) {
  // Both are EPA per play from the offense's side, so the attacking team
  // wants the bigger number and the defending team the smaller one. The
  // split is measured from a floor since either can be negative.
  const share = shareOf(offense.value, defense.value, -0.8)
  return (
    <div className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-3 px-4 py-2">
      <span className="text-left font-display text-base tabular-nums text-[var(--text-primary)]">
        {formatEpa(offense.value)}
      </span>
      <div className="flex flex-col items-center gap-1">
        <span className="text-center text-[11px] tracking-wider text-[var(--text-muted)] uppercase">
          {label}
        </span>
        <div className="flex h-2 w-full gap-0.5 rounded-full" aria-hidden="true">
          {[share, 100 - share]
            .map((width, index) => ({ width, color: colors[index] }))
            .filter((side) => side.width > 0)
            .map((side) => (
              <div
                key={side.color}
                style={{ width: `${side.width}%`, backgroundColor: side.color }}
                className="first:rounded-l-full last:rounded-r-full"
              />
            ))}
        </div>
      </div>
      <span className="text-right font-display text-base tabular-nums text-[var(--text-primary)]">
        {formatEpa(defense.value)}
      </span>
    </div>
  )
}

function Side({
  matchup,
  attacking,
  colors,
}: {
  matchup: Matchup
  attacking: 0 | 1
  colors: [string, string]
}) {
  const sides = matchup.preview?.teams ?? []
  const offense = sides[attacking]
  const defense = sides[attacking === 0 ? 1 : 0]
  if (!offense || !defense) return null
  // The attacking team's colour stays on the left of each bar whichever side
  // of the panel it's on, so a bar is read the same way twice.
  const pair: [string, string] =
    attacking === 0 ? [colors[0], colors[1]] : [colors[1], colors[0]]

  return (
    <div className="flex flex-col pb-2">
      <h3 className="bg-[var(--surface-2)] px-4 py-1.5 font-display text-xs font-bold tracking-wider text-[var(--text-secondary)] uppercase">
        {offense.team} offense vs {defense.team} defense
      </h3>
      {edgesFor(offense, defense).map((edge) => (
        <Edge
          key={edge.phase}
          label={edge.label}
          offense={{ team: edge.offense.team, value: edge.offense.rate.epa_per_play }}
          defense={{ team: edge.defense.team, value: edge.defense.rate.epa_per_play }}
          colors={pair}
        />
      ))}
    </div>
  )
}

function MatchupPreviewPanel({ matchup, teams }: { matchup: Matchup; teams: TeamInfo[] }) {
  const sides: PreviewTeam[] = matchup.preview?.teams ?? []
  if (sides.length < 2) return null
  const colors = contrastingPair(teams, matchup.game.away_team, matchup.game.home_team)

  return (
    <div className="flex flex-col gap-6">
      <Panel title="The Matchup">
        <div className="grid grid-cols-1 divide-y divide-[var(--border)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <Side matchup={matchup} attacking={0} colors={colors} />
          <Side matchup={matchup} attacking={1} colors={colors} />
        </div>
        <p className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-muted)]">
          EPA per play this regular season. The attacking team's number is on the left, the
          defense it's facing on the right — so for the defense, the smaller number is the better
          one.
        </p>
      </Panel>
    </div>
  )
}

export default MatchupPreviewPanel
