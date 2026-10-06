// PlayersPage.tsx
// Players route: search, a page-wide position-group toggle (drives every
// panel below it), stat leaders, a player-comparison scatter, and a
// trending-players line chart for the active position. The position lives in
// the URL (?position=WR) so the browser's back button returns to it.
import { useSearchParams } from "react-router-dom"
import PlayerComparisonScatter from "../components/PlayerComparisonScatter"
import PositionGroupToggle from "../components/PositionGroupToggle"
import SearchBar from "../components/SearchBar"
import StatLeadersPanel from "../components/StatLeadersPanel"
import TrendingPlayersChart from "../components/TrendingPlayersChart"
import { POSITION_GROUPS, type PositionGroup } from "../data/leaderCategories"

function isPositionGroup(value: string | null): value is PositionGroup {
  return POSITION_GROUPS.includes(value as PositionGroup)
}

function PlayersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  // The URL is user-editable: match case-insensitively (?position=wr works),
  // and anything unrecognized falls back to QB.
  const param = searchParams.get("position")?.toUpperCase() ?? null
  const position = isPositionGroup(param) ? param : POSITION_GROUPS[0]
  // replace: switching tabs updates the current history entry instead of
  // adding one, so Back leaves the page rather than stepping through tabs.
  const setPosition = (next: PositionGroup) => setSearchParams({ position: next }, { replace: true })

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
          <SearchBar placeholder="Search players..." scope="players" />
        </div>
      </div>
      <StatLeadersPanel position={position} />
      <PlayerComparisonScatter position={position} />
      <TrendingPlayersChart position={position} />
    </div>
  )
}

export default PlayersPage
