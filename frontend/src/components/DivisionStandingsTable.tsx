import { type DivisionStanding, formatPct, winPct } from "../data/dummyStandings"
import Panel from "./Panel"

function DivisionStandingsTable({ name, teams }: DivisionStanding) {
  const sorted = [...teams].sort((a, b) => winPct(b) - winPct(a))

  return (
    <Panel title={name}>
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="text-left text-[var(--text-muted)]">
            <th className="w-6 px-4 py-2 font-normal">#</th>
            <th className="px-2 py-2 font-normal">Team</th>
            <th className="w-7 px-2 py-2 text-right font-normal">W</th>
            <th className="w-7 px-2 py-2 text-right font-normal">L</th>
            <th className="w-7 px-2 py-2 text-right font-normal">T</th>
            <th className="w-14 px-4 py-2 text-right font-normal">PCT</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((record, index) => (
            <tr key={record.team} className="border-t border-[var(--border)]">
              <td className="px-4 py-2 align-top text-[var(--text-muted)]">{index + 1}</td>
              <td className="px-2 py-2 align-top font-medium text-[var(--text-primary)]">{record.team}</td>
              <td className="px-2 py-2 align-top text-right text-[var(--text-secondary)]">{record.wins}</td>
              <td className="px-2 py-2 align-top text-right text-[var(--text-secondary)]">{record.losses}</td>
              <td className="px-2 py-2 align-top text-right text-[var(--text-secondary)]">{record.ties}</td>
              <td className="px-4 py-2 align-top text-right tabular-nums text-[var(--text-primary)]">
                {formatPct(record)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

export default DivisionStandingsTable
