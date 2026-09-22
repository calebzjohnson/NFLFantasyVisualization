// PlayerPage.tsx
// Individual player route: ESPN-style bio header, rest of the page pending.
import { useParams } from "react-router-dom"
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
    <div>
      {loading && <p className="text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="text-sm text-[var(--negative)]">Couldn't load player: {error}</p>}
      {bio.data && <PlayerBioBar bio={bio.data} team={team} />}
      <p className="mt-6 text-[var(--text-secondary)]">Coming soon.</p>
    </div>
  )
}

export default PlayerPage
