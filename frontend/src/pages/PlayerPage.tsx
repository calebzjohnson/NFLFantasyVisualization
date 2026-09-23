// PlayerPage.tsx
// Individual player route: ESPN-style bio header, then vs-league-average
// charts (radar, team usage, beeswarm - all placeholders for now), then the
// real game log table.
import { useParams } from "react-router-dom"
import ChartPlaceholder from "../components/ChartPlaceholder"
import GameLogPanel from "../components/GameLogPanel"
import PlayerBioBar from "../components/PlayerBioBar"
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
            <ChartPlaceholder
              title="Vs. League Average"
              description="Radar chart comparing this player's key stats to the league average at their position."
            />
            <ChartPlaceholder
              title="Team Usage"
              description="Donut chart of this player's share of their team's snaps or touches."
            />
          </div>
          <ChartPlaceholder
            title="League Comparison"
            description="Beeswarm plot of every player at the position, with this player's dot highlighted."
            aspectClassName="aspect-[3/1]"
          />
          <GameLogPanel playerId={playerId} position={bio.data.position} />
        </>
      )}
    </div>
  )
}

export default PlayerPage
