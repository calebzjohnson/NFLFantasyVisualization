// PlayersPage.tsx
// Players route: search, a page-wide position-group toggle (drives every
// panel below it), stat leaders, a real player-comparison scatter, and a
// placeholder trend chart for the active position.
import { useState } from "react"
import PlayerComparisonScatter from "../components/PlayerComparisonScatter"
import PositionGroupToggle from "../components/PositionGroupToggle"
import SearchBar from "../components/SearchBar"
import StatLeadersPanel from "../components/StatLeadersPanel"
import TrendingPlayersPlaceholder from "../components/TrendingPlayersPlaceholder"
import { POSITION_GROUPS, type PositionGroup } from "../data/leaderCategories"

function PlayersPage() {
  const [position, setPosition] = useState<PositionGroup>(POSITION_GROUPS[0])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-display text-3xl font-bold tracking-wide text-[var(--text-primary)] uppercase">
            Players
          </h1>
          <PositionGroupToggle
            options={POSITION_GROUPS}
            active={position}
            onChange={setPosition}
            aria-label="Position group"
          />
        </div>
        <div className="w-56">
          <SearchBar placeholder="Search players..." />
        </div>
      </div>
      <StatLeadersPanel position={position} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PlayerComparisonScatter position={position} />
        <TrendingPlayersPlaceholder position={position} />
      </div>
    </div>
  )
}

export default PlayersPage
