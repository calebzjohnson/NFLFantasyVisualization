// MatchupSlate.tsx
// A week's games as links into each matchup, with Prev/Next paging the week.
// Played games show the final score and which side won; upcoming ones show
// the kickoff. Unlike PreviousWeekScores (the home page's read-only
// scoreboard) every row here is a link, and there's no bye-week filler -
// this page is about the games themselves.
import { Link } from "react-router-dom"
import { byKickoff, formatKickoff, type GameScore } from "../data/scores"
import { logoByTeam, type TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"
import { TeamLogoBadge } from "./TeamLogo"

// One side of a card, mirrored for the home team so both logos sit on the
// outside edges and the two scores meet in the middle.
function Side({
  team,
  logo,
  score,
  won,
  home,
}: {
  team: string
  logo: string | undefined
  score: number | null
  won: boolean
  home: boolean
}) {
  const tone = won ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
  // justify-between pins the logo and name to the card's outside edge and the
  // score to the inside, so the two scores meet either side of the middle.
  return (
    <div
      className={`flex min-w-0 flex-1 items-center justify-between gap-2 ${
        home ? "flex-row-reverse" : ""
      }`}
    >
      <span className={`flex min-w-0 items-center gap-2 ${home ? "flex-row-reverse" : ""}`}>
        {logo && <TeamLogoBadge logo={logo} size="h-11 w-11" />}
        <span className={`font-display text-[1.4rem] font-semibold tracking-wide ${tone}`}>{team}</span>
      </span>
      {score !== null && (
        <span className={`font-display text-[1.4rem] tabular-nums ${won ? "font-bold" : ""} ${tone}`}>
          {score}
        </span>
      )}
    </div>
  )
}

function GameCard({ game, logos }: { game: GameScore; logos: Map<string, string> }) {
  const final = game.status === "final"
  const awayWon = final && (game.away_score ?? 0) > (game.home_score ?? 0)
  const homeWon = final && (game.home_score ?? 0) > (game.away_score ?? 0)

  return (
    <Link
      to={`/matchups/${game.game_id}`}
      className="flex flex-col items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 transition-colors hover:border-[var(--accent)]"
    >
      <div className="flex w-full items-center gap-3">
        <Side
          team={game.away_team}
          logo={logos.get(game.away_team)}
          score={game.away_score}
          won={awayWon}
          home={false}
        />
        <span className="shrink-0 text-xs text-[var(--text-muted)]">{final ? "–" : "@"}</span>
        <Side
          team={game.home_team}
          logo={logos.get(game.home_team)}
          score={game.home_score}
          won={homeWon}
          home
        />
      </div>
      <span className="text-[11px] tracking-wider text-[var(--text-muted)] uppercase">
        {final ? "Final" : formatKickoff(game)}
      </span>
    </Link>
  )
}

interface SlateProps {
  week: number | null
  onWeekChange: (week: number) => void
  minWeek: number
  maxWeek: number
}

function MatchupSlate({ week, onWeekChange, minWeek, maxWeek }: SlateProps) {
  const games = useFetch<GameScore[]>(week === null ? "/scores" : `/scores?week=${week}`)
  const teams = useFetch<TeamInfo[]>("/teams")

  // Before a week is chosen the games themselves say which week this is, so
  // paging from the default lands on the right neighbour.
  const logos = logoByTeam(teams.data)
  const shown = week ?? games.data?.[0]?.week ?? minWeek
  const slate = games.data ? [...games.data].sort(byKickoff) : []

  return (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-2">
        <button
          type="button"
          onClick={() => onWeekChange(shown - 1)}
          disabled={shown <= minWeek}
          className="rounded px-2 py-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="font-display text-sm font-bold tracking-wider text-[var(--text-primary)] uppercase">
          Week {shown}
        </span>
        <button
          type="button"
          onClick={() => onWeekChange(shown + 1)}
          disabled={shown >= maxWeek}
          className="rounded px-2 py-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
        >
          Next →
        </button>
      </div>
      {games.loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {games.error && (
        <p className="p-4 text-sm text-[var(--negative)]">Couldn't load games: {games.error}</p>
      )}
      {games.data && slate.length === 0 && (
        <p className="p-4 text-sm text-[var(--text-secondary)]">No games scheduled this week.</p>
      )}
      {slate.length > 0 && (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {slate.map((game) => (
            <GameCard key={game.game_id} game={game} logos={logos} />
          ))}
        </div>
      )}
    </>
  )
}

export default MatchupSlate
