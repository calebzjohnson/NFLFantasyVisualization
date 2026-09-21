// PreviousWeekScores.tsx
// Fetches /scores for a selectable week and lists that week's games
// chronologically. Defaults to the backend's current week; Prev/Next page
// through the rest of the season. Capped at 18 (regular season only) for
// now - playoff weeks (19-22) aren't populated in the data until the
// regular season ends, so raising this cap needs an empty-state message too.
// Teams on bye are listed after the games in a block that fills the rows the
// missing games would have taken, so the panel is the same height (16 rows)
// every week.
import { useState } from "react"
import {
  byeTeams,
  byKickoff,
  formatKickoff,
  isRegularSeasonSlate,
  SLATE_ROWS,
  type GameScore,
} from "../data/scores"
import type { TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"
import Panel from "./Panel"

const MIN_WEEK = 1
const MAX_WEEK = 18

function TeamLine({
  team,
  score,
  won,
}: {
  team: string
  score: number | null
  won: boolean
}) {
  const tone = won ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={tone}>{team}</span>
      <span className={`font-display text-xl tabular-nums ${tone}`}>{score ?? "–"}</span>
    </div>
  )
}

function PreviousWeekScores() {
  const [week, setWeek] = useState<number | null>(null)
  const path = week === null ? "/scores" : `/scores?week=${week}`
  const { data, error, loading } = useFetch<GameScore[]>(path)
  const teams = useFetch<TeamInfo[]>("/teams")

  // Keep showing the previous week's slate (dimmed) while the next one loads, so
  // the panel holds its height instead of collapsing and reflowing the page on
  // every Prev/Next click.
  const [previous, setPrevious] = useState<GameScore[] | null>(null)
  if (data && data !== previous) setPrevious(data)
  const shown = error ? null : (data ?? previous)

  const games = shown ? [...shown].sort(byKickoff) : null
  const byes = games ? byeTeams(games, teams.data ?? []) : []
  // A full slate is SLATE_ROWS games, so the bye block spans the rows the
  // missing games would have taken (two teams per missing game).
  const fixedSlate = games ? isRegularSeasonSlate(games) : false
  const byeRows = SLATE_ROWS - (games?.length ?? 0)
  const displayedWeek = week ?? games?.[0]?.week

  return (
    <Panel
      title="Scoreboard"
      actions={
        displayedWeek !== undefined && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeek(Math.max(MIN_WEEK, displayedWeek - 1))}
              disabled={displayedWeek <= MIN_WEEK}
              className="rounded bg-[var(--surface-0)] px-2 py-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              ←
            </button>
            <span className="rounded bg-[var(--surface-0)] px-2 py-0.5 text-xs tracking-wider text-[var(--text-muted)] uppercase">
              Week {displayedWeek}
            </span>
            <button
              type="button"
              onClick={() => setWeek(Math.min(MAX_WEEK, displayedWeek + 1))}
              disabled={displayedWeek >= MAX_WEEK}
              className="rounded bg-[var(--surface-0)] px-2 py-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              →
            </button>
          </div>
        )
      }
    >
      {loading && !games && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load scores: {error}</p>}
      {games && (
        <ul
          className={`divide-y divide-[var(--border)] transition-opacity ${fixedSlate ? "grid" : ""} ${loading ? "opacity-50" : ""}`}
          style={fixedSlate ? { gridTemplateRows: `repeat(${SLATE_ROWS}, 1fr)` } : undefined}
        >
          {games.map((game) => (
            <li key={game.game_id} className="px-4 py-3 hover:bg-[var(--surface-2)]">
              <div className="mb-1 text-xs tracking-wider text-[var(--text-muted)] uppercase">
                {formatKickoff(game)}
              </div>
              <TeamLine
                team={game.away_team}
                score={game.away_score}
                won={
                  game.status === "final" &&
                  game.away_score !== null &&
                  game.home_score !== null &&
                  game.away_score > game.home_score
                }
              />
              <TeamLine
                team={game.home_team}
                score={game.home_score}
                won={
                  game.status === "final" &&
                  game.away_score !== null &&
                  game.home_score !== null &&
                  game.home_score > game.away_score
                }
              />
            </li>
          ))}
          {byes.length > 0 && byeRows > 0 && (
            <li className="px-4 py-3" style={{ gridRow: `span ${byeRows}` }}>
              <div className="mb-1 text-xs tracking-wider text-[var(--text-muted)] uppercase">
                Bye
              </div>
              <ul>
                {byes.map((team) => (
                  <li key={team} className="flex min-h-7 items-center text-[var(--text-secondary)]">
                    {team}
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ul>
      )}
    </Panel>
  )
}

export default PreviousWeekScores
