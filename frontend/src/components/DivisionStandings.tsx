import { DUMMY_STANDINGS } from "../data/dummyStandings"
import DivisionStandingsTable from "./DivisionStandingsTable"
import Panel from "./Panel"

function DivisionStandings() {
  return (
    <Panel title="Division Standings">
      <div className="grid grid-cols-1 gap-4 p-4">
        {DUMMY_STANDINGS.map((division) => (
          <DivisionStandingsTable key={division.name} {...division} />
        ))}
      </div>
    </Panel>
  )
}

export default DivisionStandings
