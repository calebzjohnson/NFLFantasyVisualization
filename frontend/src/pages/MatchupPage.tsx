// MatchupPage.tsx
// Route /matchups/:gameId: one game. The header is the same either way; what
// follows depends on whether the game has been played - a preview before
// kickoff, a breakdown after it.
import { Link, useParams, useSearchParams } from "react-router-dom"
import MatchupBoxScore from "../components/MatchupBoxScore"
import MatchupComparison from "../components/MatchupComparison"
import MatchupDrives from "../components/MatchupDrives"
import MatchupLeaders from "../components/MatchupLeaders"
import MatchupPreviewPanel from "../components/MatchupPreviewPanel"
import MatchupWinProbability from "../components/MatchupWinProbability"
import PositionGroupToggle from "../components/PositionGroupToggle"
import { TeamLogoBadge } from "../components/TeamLogo"
import { quarterLabel, type Matchup, type RecentGame } from "../data/matchups"
import { findTeamStanding, formatRecord, type DivisionStanding } from "../data/standings"
import { logoByTeam, type TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"
import { usePageTitle } from "../lib/usePageTitle"

function kickoff(matchup: Matchup): string {
  const { gameday, weekday, gametime } = matchup.game
  const time = new Date(`2000-01-01T${gametime}:00`).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
  return `${weekday} ${gameday} · ${time}`
}

const RESULT_FILL: Record<RecentGame["result"], string> = {
  W: "bg-[var(--positive)]",
  L: "bg-[#b3261e]",
  T: "bg-[var(--text-muted)]",
}

// A result is a letter as well as a colour, links to its own recap, and
// gives the score on hover - three pills saying what a panel was.
function Form({ form }: { form: RecentGame[] }) {
  if (form.length === 0) return null
  // Left to right, newest to oldest, on both sides of the header - mirroring
  // the home team's would put its newest result furthest from the eye.
  return (
    <span className="flex gap-1">
      {form.map((game) => (
        <span key={game.week} className="group relative">
          <Link
            to={`/matchups/${game.game_id}`}
            className={`flex h-5 w-5 items-center justify-center rounded-full font-display text-[11px] text-white transition-transform hover:scale-110 ${
              RESULT_FILL[game.result]
            }`}
          >
            {game.result}
            <span className="sr-only">
              {` week ${game.week}, ${game.points_for} to ${game.points_against} ${
                game.home ? "against" : "at"
              } ${game.opponent}`}
            </span>
          </Link>
          <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 hidden -translate-x-1/2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-center whitespace-nowrap shadow-lg group-hover:block group-focus-within:block">
            <span className="block font-display text-lg tabular-nums text-[var(--text-primary)]">
              {game.result} {game.points_for}-{game.points_against}
            </span>
            <span className="block text-sm text-[var(--text-secondary)]">
              {game.home ? "vs" : "at"} {game.opponent}
            </span>
            <span className="block text-xs text-[var(--text-muted)]">Week {game.week}</span>
          </span>
        </span>
      ))}
    </span>
  )
}

interface SideProps {
  side: { team: string; score: number | null }
  winner: string | null
  logos: Map<string, string>
  record: string | null
  form: RecentGame[]
  home: boolean
}

// Mirrored for the home team, so both logos sit on the header's outside
// edges and the two scores meet in the middle - the slate card's shape, one
// size up.
function Side({ side: { team, score }, winner, logos, record, form, home }: SideProps) {
  const tone = winner === team ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
  return (
    <div
      className={`flex w-full min-w-0 flex-1 items-center justify-between gap-3 ${
        home ? "sm:flex-row-reverse" : ""
      }`}
    >
      <span className={`flex min-w-0 items-center gap-3 ${home ? "sm:flex-row-reverse" : ""}`}>
        {logos.has(team) && <TeamLogoBadge logo={logos.get(team) as string} size="h-12 w-12 sm:h-16 sm:w-16" />}
        <span className={`flex min-w-0 flex-col ${home ? "sm:items-end" : ""}`}>
          <Link
            to={`/teams/${team}`}
            className={`font-display text-3xl tracking-wide hover:text-[var(--accent)] sm:text-4xl ${
              winner === team ? "font-bold" : "font-semibold"
            } ${tone}`}
          >
            {team}
          </Link>
          <span className={`flex items-center gap-2 ${home ? "flex-row-reverse" : ""}`}>
            {record && (
              <span className="text-sm tabular-nums text-[var(--text-muted)]">{record}</span>
            )}
            <Form form={form} />
          </span>
        </span>
      </span>
      {score !== null && (
        <span
          className={`font-display text-3xl tabular-nums sm:text-4xl ${
            winner === team ? "font-bold" : ""
          } ${tone}`}
        >
          {score}
        </span>
      )}
    </div>
  )
}

// The quarters sit between the two teams, so the header reads as a
// scoreboard: each side's total on the inside, how it was reached in the
// middle.
function LineScore({ matchup }: { matchup: Matchup }) {
  const quarters = matchup.breakdown?.line_score ?? []
  if (quarters.length === 0) return null
  const { away_team, home_team } = matchup.game

  return (
    <table className="order-last shrink-0 text-center font-display text-sm tabular-nums sm:order-none sm:mx-5">
      <caption className="sr-only">Scoring by quarter</caption>
      <thead>
        <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
          <th scope="col" className="border-r border-[var(--border)]">
            <span className="sr-only">Team</span>
          </th>
          {quarters.map((quarter) => (
            <th key={quarter.quarter} scope="col" className="px-1.5 pl-2.5 font-normal first:pl-2.5">
              {quarterLabel(quarter.quarter)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="text-[var(--text-secondary)]">
        {(["away", "home"] as const).map((side) => (
          <tr key={side}>
            <th
              scope="row"
              className="border-r border-[var(--border)] pr-2 text-right font-semibold tracking-wide text-[var(--text-muted)]"
            >
              {side === "away" ? away_team : home_team}
            </th>
            {quarters.map((quarter) => (
              <td key={quarter.quarter} className="px-1.5">
                {quarter[side]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Header({
  matchup,
  logos,
  standings,
}: {
  matchup: Matchup
  logos: Map<string, string>
  standings: DivisionStanding[]
}) {
  const formOf = (team: string) =>
    (matchup.preview?.teams ?? []).find((side) => side.team === team)?.form ?? []
  const { game } = matchup
  const final = matchup.status === "final"
  const overtime = (matchup.breakdown?.line_score ?? []).some((quarter) => quarter.quarter > 4)
  const recordOf = (team: string) => {
    const standing = findTeamStanding(standings, team)
    return standing ? formatRecord(standing.record) : null
  }
  const sides = [
    { team: game.away_team, score: game.away_score, at: "at" },
    { team: game.home_team, score: game.home_score, at: "" },
  ]
  const winner =
    final && game.away_score !== null && game.home_score !== null
      ? game.away_score > game.home_score
        ? game.away_team
        : game.home_team
      : null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-4 py-4 shadow-lg shadow-black/30">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tracking-wider text-[var(--text-muted)] uppercase">
        <Link to={`/matchups?week=${game.week}`} className="hover:text-[var(--accent)]">
          Week {game.week}
        </Link>
        <span>{final ? (overtime ? "Final/OT" : "Final") : kickoff(matchup)}</span>
        {game.div_game === 1 && <span className="text-[var(--accent)]">Division game</span>}
      </div>
      {/* Same shape as a slate card, one size up: logos on the outside
          edges, the two scores meeting either side of the middle. */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-3">
        <Side
          side={sides[0]}
          winner={winner}
          logos={logos}
          record={recordOf(sides[0].team)}
          form={formOf(sides[0].team)}
          home={false}
        />
        {final ? (
          <LineScore matchup={matchup} />
        ) : (
          <span className="shrink-0 text-sm text-[var(--text-muted)]">@</span>
        )}
        <Side
          side={sides[1]}
          winner={winner}
          logos={logos}
          record={recordOf(sides[1].team)}
          form={formOf(sides[1].team)}
          home
        />
      </div>
    </div>
  )
}

const MATCHUP_TABS = ["game", "box-score"] as const
type MatchupTab = (typeof MATCHUP_TABS)[number]

const TAB_LABELS: Record<MatchupTab, string> = {
  game: "Game",
  "box-score": "Box Score",
}

function isMatchupTab(value: string | null): value is MatchupTab {
  return MATCHUP_TABS.includes(value as MatchupTab)
}

function MatchupPage() {
  const { gameId = "" } = useParams<{ gameId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const matchup = useFetch<Matchup>(`/matchups/${gameId}`)
  const teams = useFetch<TeamInfo[]>("/teams")
  const standings = useFetch<DivisionStanding[]>("/standings")

  // The URL is user-editable, so anything unrecognized falls back to Game.
  const param = searchParams.get("tab")?.toLowerCase() ?? null
  const tab = isMatchupTab(param) ? param : MATCHUP_TABS[0]
  const setTab = (next: MatchupTab) => setSearchParams({ tab: next }, { replace: true })

  const title = matchup.data
    ? `${matchup.data.game.away_team} at ${matchup.data.game.home_team}`
    : "Matchup"
  usePageTitle(title)

  return (
    <div className="flex flex-col gap-6">
      {matchup.loading && <p className="text-sm text-[var(--text-secondary)]">Loading…</p>}
      {matchup.error && (
        <p className="text-sm text-[var(--negative)]">Couldn't load matchup: {matchup.error}</p>
      )}
      {matchup.data && (
        <>
          <Header
            matchup={matchup.data}
            logos={logoByTeam(teams.data)}
            standings={standings.data ?? []}
          />
          {matchup.data.status !== "final" && (
            <>
              <MatchupPreviewPanel matchup={matchup.data} teams={teams.data ?? []} />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <MatchupComparison
                  sides={matchup.data.preview?.teams ?? []}
                  teams={teams.data ?? []}
                  title="Season Comparison"
                  caption="Per game averages this season, except third downs, which are season totals."
                />
                <MatchupLeaders
                  rows={matchup.data.preview?.leaders ?? []}
                  away={matchup.data.game.away_team}
                  home={matchup.data.game.home_team}
                  teams={teams.data ?? []}
                  title="Season Leaders"
                  caption="Per game averages this season, among players in at least half their team's games."
                />
              </div>
            </>
          )}
          {matchup.data.status === "final" && (
            <>
              <PositionGroupToggle
                options={MATCHUP_TABS}
                active={tab}
                onChange={setTab}
                labelFor={(value) => TAB_LABELS[value]}
                aria-label="Matchup view"
              />
              {tab === "game" && (
                <>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <MatchupComparison
                      sides={matchup.data.breakdown?.teams ?? []}
                      teams={teams.data ?? []}
                    />
                    <MatchupLeaders
                      rows={matchup.data.breakdown?.leaders ?? []}
                      away={matchup.data.game.away_team}
                      home={matchup.data.game.home_team}
                      teams={teams.data ?? []}
                      awaitingPressures={(matchup.data.breakdown?.teams ?? []).some(
                        (team) => team.pressures === null,
                      )}
                    />
                  </div>
                  <MatchupWinProbability matchup={matchup.data} teams={teams.data ?? []} />
                  <MatchupDrives matchup={matchup.data} teams={teams.data ?? []} />
                </>
              )}
              {tab === "box-score" && (
                <MatchupBoxScore matchup={matchup.data} teams={teams.data ?? []} />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default MatchupPage
