// TeamDepthChartPanel.tsx
// The team page's Depth Chart tab: a table per unit, then every flagged
// player's status in one list.
import { Link } from "react-router-dom"
import { STATUS_NAME, STATUS_TONE, type DepthChartResponse } from "../data/depthChart"
import { useFetch } from "../lib/useFetch"
import DepthChartTable from "./DepthChartTable"
import Panel from "./Panel"

// Mounted only while its tab is open, so Overview never pays for this fetch;
// useFetch caches per path, so switching back is instant.
function TeamDepthChartPanel({ teamAbbr }: { teamAbbr: string }) {
  const chart = useFetch<DepthChartResponse>(`/teams/${teamAbbr}/depth-chart`)

  if (chart.error) {
    return (
      <Panel title="Depth Chart">
        <p className="p-4 text-sm text-[var(--negative)]">Couldn't load depth chart: {chart.error}</p>
      </Panel>
    )
  }
  if (!chart.data) {
    return (
      <Panel title="Depth Chart">
        <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>
      </Panel>
    )
  }

  const { groups, report } = chart.data

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <Panel key={group.key} title={group.label}>
          <div className="overflow-x-auto">
            <DepthChartTable group={group} />
          </div>
        </Panel>
      ))}
      <Panel title="Injury Report">
        {report.length === 0 ? (
          <p className="p-4 text-sm text-[var(--text-secondary)]">No players carry a status.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wider text-[var(--text-muted)] uppercase">
                  <th scope="col" className="w-16 px-4 py-2 font-medium">
                    Pos
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Player
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Injury
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Practice
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.map((row) => (
                  <tr
                    key={row.player_id}
                    className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]"
                  >
                    <th
                      scope="row"
                      className="px-4 py-2 text-left font-display font-bold text-[var(--text-secondary)]"
                    >
                      {row.position ?? "—"}
                    </th>
                    <td className="px-2 py-2 whitespace-nowrap text-[var(--text-primary)]">
                      {row.player_id ? (
                        <Link
                          to={`/players/${row.player_id}`}
                          state={{ playerName: row.name }}
                          className="hover:text-[var(--accent)] hover:underline"
                        >
                          {row.name}
                        </Link>
                      ) : (
                        row.name
                      )}
                    </td>
                    <td className={`px-2 py-2 font-display font-bold ${STATUS_TONE[row.status]}`}>
                      {STATUS_NAME[row.status]}
                    </td>
                    <td className="px-2 py-2 text-[var(--text-secondary)]">{row.injury ?? "—"}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">
                      {row.practice_status ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

export default TeamDepthChartPanel
