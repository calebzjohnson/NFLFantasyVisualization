import { DUMMY_SCORES } from "../data/dummyScores"
import Panel from "./Panel"

function PreviousWeekScores() {
  return (
    <Panel
      title="Previous Week Scores"
      actions={<span className="text-xs text-[var(--text-muted)]">Week 18 · Final</span>}
    >
      <ul className="divide-y divide-[var(--border)]">
        {DUMMY_SCORES.map((game) => {
          const homeWon = game.home.score > game.away.score
          const awayWon = game.away.score > game.home.score
          return (
            <li key={game.id} className="px-4 py-3">
              <div className="mb-1 text-xs text-[var(--text-muted)]">{game.kickoff}</div>
              <div className="flex items-center justify-between gap-4">
                <span
                  className={
                    awayWon
                      ? "font-semibold text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)]"
                  }
                >
                  {game.away.team}
                </span>
                <span className="tabular-nums font-medium text-[var(--text-primary)]">
                  {game.away.score}
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
                  {game.home.team}
                </span>
                <span className="tabular-nums font-medium text-[var(--text-primary)]">
                  {game.home.score}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

export default PreviousWeekScores
