// GameLogPanel.tsx
// Fetches a player's game-by-game stat line and renders it as an ESPN-style
// table, with columns picked to match their position.
import { gameLogConfigForPosition, type GameStatsRow } from "../data/gameLog"
import { useFetch } from "../lib/useFetch"
import GameLogTable, { type GameLogRow } from "./GameLogTable"
import Panel from "./Panel"

function GameLogPanel({ playerId, position }: { playerId: string; position: string | null }) {
  const { data, error, loading } = useFetch<GameStatsRow[]>(`/players/${playerId}/games`)
  const config = gameLogConfigForPosition(position)

  const rows: GameLogRow[] | null =
    config && data
      ? data.map((row) => ({
          week: row.week,
          opponent: row.opponent_team,
          stats: config.toStats(row),
        }))
      : null

  return (
    <Panel title="Game Log">
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load game log: {error}</p>}
      {data && !config && (
        <p className="p-4 text-sm text-[var(--text-secondary)]">
          No detailed game log available for this position yet.
        </p>
      )}
      {rows && rows.length === 0 && (
        <p className="p-4 text-sm text-[var(--text-secondary)]">No games played yet this season.</p>
      )}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <GameLogTable columns={config!.columns} rows={rows} totals={config!.toTotals(data!)} />
        </div>
      )}
    </Panel>
  )
}

export default GameLogPanel
