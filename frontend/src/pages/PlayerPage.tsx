// PlayerPage.tsx
// Individual player route: ESPN-style bio header, then vs-league-average
// charts (radar, team usage, and beeswarm are all real), then the real game
// log table.
import { useParams } from "react-router-dom"
import GameLogPanel from "../components/GameLogPanel"
import LeagueComparisonBeeswarm from "../components/LeagueComparisonBeeswarm"
import PlayerBioBar from "../components/PlayerBioBar"
import PlayerRadarChart from "../components/PlayerRadarChart"
import TeamUsagePanel from "../components/TeamUsagePanel"
import type { PlayerBio } from "../data/playerBio"
import type { TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"

function PlayerPage() {
  const { playerId } = useParams<{ playerId: string }>()
  const bio = useFetch<PlayerBio>(`/players/${playerId}/bio`)
  const teams = useFetch<TeamInfo[]>("/teams")

  const loading = bio.loading || teams.loading
  const error = bio.error ?? teams.error
  const team = bio.data && teams.data ? (teams.data.find((t) => t.team_abbr === bio.data!.team) ?? null) : null

  return (
    <div className="flex flex-col gap-6">
      {loading && <p className="text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="text-sm text-[var(--negative)]">Couldn't load player: {error}</p>}
      {bio.data && <PlayerBioBar bio={bio.data} team={team} />}
      {bio.data && playerId && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PlayerRadarChart playerId={playerId} teamColor={team?.team_color ?? "var(--accent)"} />
            <TeamUsagePanel playerId={playerId} playerName={bio.data.display_name} />
          </div>
          <LeagueComparisonBeeswarm playerId={playerId} teamColor={team?.team_color ?? "var(--accent)"} />
          <GameLogPanel playerId={playerId} position={bio.data.position} />
        </>
      )}
    </div>
  )
}

export default PlayerPage
