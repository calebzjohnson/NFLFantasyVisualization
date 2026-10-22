// MatchupBoxScore.tsx
// Every player who did something in the game, by team and by section. A
// player is in a section only if he has a number in it, so the quarterback
// isn't listed among the receivers.
import { Link } from "react-router-dom"
import type { BoxPlayer, BoxTeam, Matchup } from "../data/matchups"
import { logoByTeam, type TeamInfo } from "../data/teams"
import Panel from "./Panel"
import { TeamLogoBadge } from "./TeamLogo"

interface Column {
  key: string
  label: string
}

const SECTIONS: { key: keyof Omit<BoxTeam, "team">; label: string; columns: Column[] }[] = [
  {
    key: "passing",
    label: "Passing",
    columns: [
      { key: "completions", label: "C" },
      { key: "attempts", label: "ATT" },
      { key: "passing_yards", label: "YDS" },
      { key: "passing_tds", label: "TD" },
      { key: "passing_interceptions", label: "INT" },
      { key: "sacks_suffered", label: "SCK" },
    ],
  },
  {
    key: "rushing",
    label: "Rushing",
    columns: [
      { key: "carries", label: "CAR" },
      { key: "rushing_yards", label: "YDS" },
      { key: "rushing_tds", label: "TD" },
      { key: "rushing_fumbles_lost", label: "FUM" },
    ],
  },
  {
    key: "receiving",
    label: "Receiving",
    columns: [
      { key: "targets", label: "TGT" },
      { key: "receptions", label: "REC" },
      { key: "receiving_yards", label: "YDS" },
      { key: "receiving_tds", label: "TD" },
      { key: "receiving_fumbles_lost", label: "FUM" },
    ],
  },
  {
    key: "defense",
    label: "Defense",
    columns: [
      { key: "total_tackles", label: "TKL" },
      { key: "def_sacks", label: "SCK" },
      { key: "def_interceptions", label: "INT" },
      { key: "pressures", label: "PRS" },
      { key: "def_tds", label: "TD" },
    ],
  },
]

function cell(player: BoxPlayer, key: string): string {
  const value = player[key]
  if (value === null || value === undefined) return "—"
  return String(value)
}

function SectionTable({
  label,
  columns,
  players,
}: {
  label: string
  columns: Column[]
  players: BoxPlayer[]
}) {
  if (players.length === 0) return null
  return (
    <div className="overflow-x-auto border-t border-[var(--border)] first:border-0">
      <table className="w-full min-w-[26rem] text-sm">
        <caption className="bg-[var(--surface-2)] px-4 py-2 text-left font-display text-xs font-bold tracking-wider text-[var(--text-secondary)] uppercase">
          {label}
        </caption>
        <thead>
          <tr className="border-b border-[var(--border)] text-[11px] tracking-wider text-[var(--text-muted)] uppercase">
            <th scope="col" className="w-full py-2 pr-3 pl-4 text-left font-normal">
              Player
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="w-12 px-1 py-2 text-right font-normal last:pr-4"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            <tr
              key={player.player_id ?? `${player.name}-${index}`}
              className="border-b border-[var(--border)] last:border-0"
            >
              <th scope="row" className="py-2 pr-3 pl-4 text-left font-normal">
                {player.player_id ? (
                  <Link
                    to={`/players/${player.player_id}`}
                    className="text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                  >
                    {player.name ?? "Unknown"}
                  </Link>
                ) : (
                  <span className="text-[var(--text-primary)]">{player.name ?? "Unknown"}</span>
                )}
                {player.position && (
                  <span className="pl-1.5 text-xs text-[var(--text-muted)]">{player.position}</span>
                )}
              </th>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="px-1 py-2 text-right font-display tabular-nums text-[var(--text-secondary)] last:pr-4"
                >
                  {cell(player, column.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MatchupBoxScore({ matchup, teams }: { matchup: Matchup; teams: TeamInfo[] }) {
  const box = matchup.breakdown?.box_score ?? []
  if (box.length === 0) {
    return (
      <Panel title="Box Score">
        <p className="p-4 text-sm text-[var(--text-secondary)]">
          No player stats are posted for this game yet.
        </p>
      </Panel>
    )
  }

  const logos = logoByTeam(teams)

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
      {box.map((team) => (
        <Panel
          key={team.team}
          title={`${team.team} Box Score`}
          actions={
            logos.has(team.team) ? (
              <TeamLogoBadge logo={logos.get(team.team) as string} size="h-8 w-8" />
            ) : undefined
          }
        >
          {SECTIONS.map((section) => (
            <SectionTable
              key={section.key}
              label={section.label}
              columns={section.columns}
              players={team[section.key]}
            />
          ))}
        </Panel>
      ))}
    </div>
  )
}

export default MatchupBoxScore
