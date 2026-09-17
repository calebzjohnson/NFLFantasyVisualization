import { byKickoff, formatKickoff, type GameScore } from "../data/scores"
import { useFetch } from "../lib/useFetch"
import Panel from "./Panel"

function PreviousWeekScores() {
  const { data, error, loading } = useFetch<GameScore[]>("/scores")
  const games = data ? [...data].sort(byKickoff) : null
  const week = games?.[0]?.week

  return (
    <Panel
      title="Previous Week Scores"
      actions={
        week !== undefined && (
          <span className="text-xs text-[var(--text-muted)]">Week {week} · Final</span>
        )
      }
    >
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-red-600">Couldn't load scores: {error}</p>}
      {games && (
        <ul className="divide-y divide-[var(--border)]">
          {games.map((game) => {
            const homeWon = game.home_score > game.away_score
            const awayWon = game.away_score > game.home_score
            return (
              <li key={game.game_id} className="px-4 py-3">
                <div className="mb-1 text-xs text-[var(--text-muted)]">{formatKickoff(game)}</div>
                <div className="flex items-center justify-between gap-4">
                  <span
                    className={
                      awayWon
                        ? "font-semibold text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    }
                  >
                    {game.away_team}
                  </span>
                  <span className="tabular-nums font-medium text-[var(--text-primary)]">
                    {game.away_score}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span
                    className={
                      homeWon
                        ? "font-semibold text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    }
                  >
                    {game.home_team}
                  </span>
                  <span className="tabular-nums font-medium text-[var(--text-primary)]">
                    {game.home_score}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export default PreviousWeekScores
