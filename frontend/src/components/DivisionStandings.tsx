// DivisionStandings.tsx
// Fetches /standings and renders every division's table in one panel.
import type { DivisionStanding } from "../data/standings"
import { useFetch } from "../lib/useFetch"
import DivisionStandingsTable from "./DivisionStandingsTable"
import Panel from "./Panel"

function DivisionStandings() {
  const { data, error, loading } = useFetch<DivisionStanding[]>("/standings")

  return (
    <Panel title="Division Standings">
      {loading && <p className="p-4 text-sm text-[var(--text-secondary)]">Loading…</p>}
      {error && <p className="p-4 text-sm text-[var(--negative)]">Couldn't load standings: {error}</p>}
      {data && (
        <div className="grid grid-cols-1 gap-4 p-4">
          {data.map((division) => (
            <DivisionStandingsTable key={division.division} {...division} />
          ))}
        </div>
      )}
    </Panel>
  )
}

export default DivisionStandings
