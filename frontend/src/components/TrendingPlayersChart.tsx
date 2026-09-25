// TrendingPlayersChart.tsx
// Trending Players: the players at the active position trending up or down
// the most in a picked stat (see trendingPlayers.ts), on the shared
// TrendChart. Clicking a line opens that player's page.
import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import type { PositionGroup } from "../data/leaderCategories"
import { PLAYER_METRICS, playersWeeklyPathForPosition, type PlayerMetric } from "../data/playerMetrics"
import { trendingPlayers, type WeeklyPlayerRow } from "../data/trendingPlayers"
import { useFetch } from "../lib/useFetch"
import TrendChart from "./TrendChart"

function TrendingPlayersChart({ position }: { position: PositionGroup }) {
  const navigate = useNavigate()
  const { data, error, loading } = useFetch<WeeklyPlayerRow[]>(playersWeeklyPathForPosition(position))

  const trends = useCallback(
    (metric: PlayerMetric) => (data ? trendingPlayers(data, metric, position) : { up: [], down: [] }),
    [data, position],
  )

  return (
    // Keyed by position so switching positions resets the picked stat to
    // that position's first metric.
    <TrendChart
      key={position}
      title="Trending Players"
      metrics={PLAYER_METRICS[position]}
      plural={`${position}s`}
      singular="player"
      loading={loading}
      error={error}
      trends={trends}
      onSelect={(line) => navigate(`/players/${line.id}`, { state: { playerName: line.name } })}
    />
  )
}

export default TrendingPlayersChart
