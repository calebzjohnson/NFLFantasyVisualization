// HomePage.tsx
// Home route: scores, division standings, and stat leaders.
import DivisionStandings from "../components/DivisionStandings"
import PreviousWeekScores from "../components/PreviousWeekScores"
import StatLeadersPanel from "../components/StatLeadersPanel"
import TeamEfficiencyScatter from "../components/TeamEfficiencyScatter"

function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <PreviousWeekScores />
          <TeamEfficiencyScatter />
        </div>
        <DivisionStandings />
      </div>
      <StatLeadersPanel />
    </div>
  )
}

export default HomePage
