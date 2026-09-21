// PreviousWeekScores.tsx
// Fetches /scores and lists the last completed week's games chronologically.
import { byKickoff, formatKickoff, type GameScore } from "../data/scores"
import { useFetch } from "../lib/useFetch"
import Panel from "./Panel"

function TeamLine({ team, score, won }: { team: string; score: number; won: boolean }) {
  const tone = won ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={tone}>{team}</span>
      <span className={`font-display text-xl tabular-nums ${tone}`}>{score}</span>
    </div>
  )
}

function PreviousWeekScores() {
  const { data, error, loading } = useFetch<GameScore[]>("/scores")
  const games = data ? [...data].sort(byKickoff) : null
  const week = games?.[0]?.week

  return (
    <Panel
      title="Previous Week Scores"
      actions={
        week !== undefined && (
          <span className="rounded bg-[var(--surface-0)] px-2 py-0.5 text-xs tracking-wider text-[var(--text-muted)] uppercase">
            Week {week} · Final
          </span>
        )
      }
    >
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load scores: {error}</p>}
      {games && (
        <ul className="divide-y divide-[var(--border)]">
          {games.map((game) => (
            <li key={game.game_id} className="px-4 py-3 hover:bg-[var(--surface-2)]">
              <div className="mb-1 text-xs tracking-wider text-[var(--text-muted)] uppercase">
                {formatKickoff(game)}
              </div>
              <TeamLine
                team={game.away_team}
                score={game.away_score}
                won={game.away_score > game.home_score}
              />
              <TeamLine
                team={game.home_team}
                score={game.home_score}
                won={game.home_score > game.away_score}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export default PreviousWeekScores
