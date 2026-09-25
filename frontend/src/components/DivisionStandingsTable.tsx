// DivisionStandingsTable.tsx
// One division's standings table, in the API's tiebreaker order.
import { type DivisionStanding, formatPct } from "../data/standings"
import Panel from "./Panel"
import TeamLink from "./TeamLink"

// Team abbreviation -> logo URL (see logoByTeam). A team missing from it just shows its abbreviation.
function DivisionStandingsTable({ division, teams, logos }: DivisionStanding & { logos: Map<string, string> }) {
  return (
    <Panel title={division}>
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="text-left text-xs tracking-wider text-[var(--text-muted)] uppercase">
            <th className="w-6 px-4 py-2 font-medium">#</th>
            <th className="px-2 py-2 font-medium">Team</th>
            <th className="w-7 px-2 py-2 text-right font-medium">W</th>
            <th className="w-7 px-2 py-2 text-right font-medium">L</th>
            <th className="w-7 px-2 py-2 text-right font-medium">T</th>
            <th className="w-16 px-4 py-2 text-right font-medium">PCT</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((record, index) => (
            <tr key={record.team} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]">
              <td
                className={`px-4 py-2 align-top font-display text-base ${
                  index === 0 ? "font-bold text-[var(--accent)]" : "text-[var(--text-muted)]"
                }`}
              >
                {index + 1}
              </td>
              <td className="px-2 py-2 align-top font-medium text-[var(--text-primary)]">
                <TeamLink team={record.team} className="flex items-center gap-2">
                  {logos.has(record.team) && (
                    <img
                      src={logos.get(record.team)}
                      alt=""
                      width={20}
                      height={20}
                      loading="lazy"
                      className="h-5 w-5 shrink-0 object-contain"
                    />
                  )}
                  {record.team}
                </TeamLink>
              </td>
              <td className="px-2 py-2 align-top text-right text-[var(--text-secondary)]">{record.wins}</td>
              <td className="px-2 py-2 align-top text-right text-[var(--text-secondary)]">{record.losses}</td>
              <td className="px-2 py-2 align-top text-right text-[var(--text-secondary)]">{record.ties}</td>
              <td className="px-4 py-2 align-top text-right tabular-nums text-[var(--text-primary)]">
                {formatPct(record.win_pct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

export default DivisionStandingsTable
