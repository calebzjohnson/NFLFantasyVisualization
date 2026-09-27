// PlayerPage.tsx
// Individual player route: ESPN-style bio header, the game log, then
// vs-league-average charts (radar, team usage, beeswarm) for positions that
// have them.
import { useParams } from "react-router-dom"
import GameLogPanel from "../components/GameLogPanel"
import LeagueComparisonBeeswarm from "../components/LeagueComparisonBeeswarm"
import PlayerBioBar from "../components/PlayerBioBar"
import PlayerRadarChart from "../components/PlayerRadarChart"
import TeamUsagePanel from "../components/TeamUsagePanel"
import { positionGroupFor } from "../data/gameLog"
import type { PositionGroup } from "../data/leaderCategories"
import type { PlayerBio } from "../data/playerBio"
import type { TeamInfo } from "../data/teams"
import { useFetch } from "../lib/useFetch"

// Groups the backend builds radar and usage profiles for. Offensive linemen
// and specialists have no per-player stats worth a percentile profile.
const PROFILE_GROUPS = new Set<PositionGroup>(["QB", "RB", "WR", "TE", "DL", "LB", "DB"])

function PlayerPage() {
  const { playerId } = useParams<{ playerId: string }>()
  const bio = useFetch<PlayerBio>(`/players/${playerId}/bio`)
  const teams = useFetch<TeamInfo[]>("/teams")

  const loading = bio.loading || teams.loading
  const error = bio.error ?? teams.error
  const group = positionGroupFor(bio.data?.position ?? null)
  const hasProfile = group !== null && PROFILE_GROUPS.has(group)
  const team = bio.data && teams.data ? (teams.data.find((t) => t.team_abbr === bio.data!.team) ?? null) : null

  return (
    <div className="flex flex-col gap-6">
      {loading && <p className="text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="text-sm text-[var(--negative)]">Couldn't load player: {error}</p>}
      {bio.data && <PlayerBioBar bio={bio.data} team={team} />}
      {bio.data && playerId && (
        <>
          <GameLogPanel playerId={playerId} position={bio.data.position} />
          {hasProfile && (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PlayerRadarChart playerId={playerId} teamColor={team?.team_color ?? "var(--accent)"} />
                <TeamUsagePanel playerId={playerId} playerName={bio.data.display_name} />
              </div>
              <LeagueComparisonBeeswarm playerId={playerId} teamColor={team?.team_color ?? "var(--accent)"} />
            </>
          )}
        </>
      )}
    </div>
  )
}

export default PlayerPage
