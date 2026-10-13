// DepthChartTable.tsx
// One unit's depth chart: a row per position slot, players across in depth
// order. Separate from the stat tables because these cells are a name and a
// status flag, not numbers.
import { Link } from "react-router-dom"
import { depthColumns, type DepthChartGroup, type DepthChartPlayer } from "../data/depthChart"
import StatusBadge from "./StatusBadge"

function PlayerCell({ player }: { player: DepthChartPlayer }) {
  return (
    <>
      {player.player_id ? (
        <Link
          to={`/players/${player.player_id}`}
          state={{ playerName: player.name }}
          className="hover:text-[var(--accent)] hover:underline"
        >
          {player.name}
        </Link>
      ) : (
        player.name
      )}
      {player.status && <StatusBadge status={player.status} injury={player.injury} />}
    </>
  )
}

function DepthChartTable({ group }: { group: DepthChartGroup }) {
  const columns = depthColumns(group)

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{group.label} depth chart</caption>
      <thead>
        <tr className="text-left text-xs tracking-wider text-[var(--text-muted)] uppercase">
          <th scope="col" className="w-16 px-4 py-2 font-medium">
            Pos
          </th>
          {columns.map((label, index) => (
            <th
              scope="col"
              key={label}
              className={`py-2 font-medium ${index === columns.length - 1 ? "px-4" : "px-2"}`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {group.slots.map((slot) => (
          <tr key={slot.slot} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]">
            <th
              scope="row"
              className="px-4 py-2 text-left font-display font-bold text-[var(--text-secondary)]"
              title={slot.position_name}
            >
              {slot.position}
            </th>
            {columns.map((label, index) => {
              const player = slot.players[index]
              return (
                <td
                  key={label}
                  className={`py-2 whitespace-nowrap text-[var(--text-primary)] ${
                    index === columns.length - 1 ? "px-4" : "px-2"
                  }`}
                >
                  {player ? <PlayerCell player={player} /> : <span className="text-[var(--text-muted)]">—</span>}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default DepthChartTable
