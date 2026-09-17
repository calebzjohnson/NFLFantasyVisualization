import SearchBar from "../components/SearchBar"
import StatLeadersPanel from "../components/StatLeadersPanel"

function PlayersPage() {
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Players</h1>
        <SearchBar placeholder="Search players..." />
      </div>
      <StatLeadersPanel />
    </div>
  )
}

export default PlayersPage
