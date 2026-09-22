// HomePage.tsx
// Home route: scores, division standings, team efficiency, and stat leaders.
// Stat Leaders keeps its own position-group toggle here (unlike the Players
// page, where a page-wide toggle drives it), since Home doesn't scope the
// rest of the page to a single position.
import { useState } from "react"
import DivisionStandings from "../components/DivisionStandings"
import PositionGroupToggle from "../components/PositionGroupToggle"
import PreviousWeekScores from "../components/PreviousWeekScores"
import StatLeadersPanel from "../components/StatLeadersPanel"
import TeamEfficiencyScatter from "../components/TeamEfficiencyScatter"
import { POSITION_GROUPS, type PositionGroup } from "../data/leaderCategories"

function HomePage() {
  const [position, setPosition] = useState<PositionGroup>(POSITION_GROUPS[0])

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <PreviousWeekScores />
          <TeamEfficiencyScatter />
        </div>
        <DivisionStandings />
      </div>
      <StatLeadersPanel
        position={position}
        actions={
          <PositionGroupToggle
            options={POSITION_GROUPS}
            active={position}
            onChange={setPosition}
            aria-label="Position group"
          />
        }
      />
    </div>
  )
}

export default HomePage
