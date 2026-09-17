import DivisionStandings from "../components/DivisionStandings"
import PreviousWeekScores from "../components/PreviousWeekScores"
import StatLeadersPanel from "../components/StatLeadersPanel"

function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PreviousWeekScores />
        <DivisionStandings />
      </div>
      <StatLeadersPanel />
    </div>
  )
}

export default HomePage
