import type { LeaderCategory } from "../data/dummyLeaders"

function LeaderTable({ title, unit, rows }: LeaderCategory) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
      <h2 className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold tracking-wide text-[var(--text-primary)] uppercase">
        {title}
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[var(--text-muted)]">
            <th className="w-8 px-4 py-2 font-normal">#</th>
            <th className="px-2 py-2 font-normal">Player</th>
            <th className="px-2 py-2 font-normal">Team</th>
            <th className="px-4 py-2 text-right font-normal">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rank} className="border-t border-[var(--border)]">
              <td className="px-4 py-2 text-[var(--text-muted)]">{row.rank}</td>
              <td className="px-2 py-2 font-medium text-[var(--text-primary)]">{row.player}</td>
              <td className="px-2 py-2 text-[var(--text-secondary)]">{row.team}</td>
              <td className="px-4 py-2 text-right tabular-nums text-[var(--text-primary)]">
                {row.yards.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default LeaderTable
