// PlayersPage.tsx
// Players route: search bar plus stat leaders.
import SearchBar from "../components/SearchBar"
import StatLeadersPanel from "../components/StatLeadersPanel"

function PlayersPage() {
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-wide text-[var(--text-primary)] uppercase">Players</h1>
        <SearchBar placeholder="Search players..." />
      </div>
      <StatLeadersPanel />
    </div>
  )
}

export default PlayersPage
