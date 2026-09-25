// TeamPage.tsx
// Individual team route (/teams/:teamAbbr), laid out like the player page:
// header bar, then the team's game log. Comparison charts come later.
import { useParams } from "react-router-dom"
import GameLogTable from "../components/GameLogTable"
import Panel from "../components/Panel"
import TeamHeaderBar from "../components/TeamHeaderBar"
import { findTeamStanding, type DivisionStanding } from "../data/standings"
import { teamGameLog, type TeamGameRow } from "../data/teamMetrics"
import type { TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"

function TeamPage() {
  const { teamAbbr = "" } = useParams<{ teamAbbr: string }>()
  const abbr = teamAbbr.toUpperCase()
  const teams = useFetch<TeamInfo[]>("/teams")
  const standings = useFetch<DivisionStanding[]>("/standings")
  const games = useFetch<TeamGameRow[]>("/teams/weekly")

  const team = teams.data?.find((t) => t.team_abbr === abbr)
  const standing = standings.data ? findTeamStanding(standings.data, abbr) : null
  const log = games.data && team ? teamGameLog(games.data, abbr) : null

  return (
    <div className="flex flex-col gap-6">
      {teams.loading && <p className="text-sm text-[var(--text-secondary)]">Loading…</p>}
      {teams.error && <p className="text-sm text-[var(--negative)]">Couldn't load team: {teams.error}</p>}
      {teams.data && !team && <p className="text-sm text-[var(--text-secondary)]">No team found for “{teamAbbr}”.</p>}
      {team && <TeamHeaderBar team={team} standing={standing} />}
      {team && (
        <Panel title="Game Log">
          {games.loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
          {games.error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load game log: {games.error}</p>}
          {log && log.rows.length === 0 && (
            <p className="p-4 text-sm text-[var(--text-secondary)]">No games played yet this season.</p>
          )}
          {log && log.rows.length > 0 && (
            <div className="overflow-x-auto">
              <GameLogTable columns={log.columns} rows={log.rows} totals={log.totals} />
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}

export default TeamPage
