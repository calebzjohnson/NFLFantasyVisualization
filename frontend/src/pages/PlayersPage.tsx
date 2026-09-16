import PositionGroupSection from "../components/PositionGroupSection"
import SearchBar from "../components/SearchBar"
import { DEFENSE_POSITION_LEADERS, OFFENSE_POSITION_LEADERS } from "../data/dummyPositionLeaders"

function PlayersPage() {
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Players</h1>
        <SearchBar placeholder="Search players..." />
      </div>
      <PositionGroupSection title="Offense" categories={OFFENSE_POSITION_LEADERS} />
      <PositionGroupSection title="Defense" categories={DEFENSE_POSITION_LEADERS} />
    </div>
  )
}

export default PlayersPage
