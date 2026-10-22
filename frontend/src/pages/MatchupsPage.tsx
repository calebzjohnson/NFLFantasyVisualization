// MatchupsPage.tsx
// Route /matchups: every game in a week, each one a link into its own
// matchup. The week lives in the URL (?week=6) so a game can be linked back
// to its slate. Games come from /scores, the same list the home page uses -
// the per-game detail is the only thing /matchups/{id} adds.
import { useSearchParams } from "react-router-dom"
import MatchupSlate from "../components/MatchupSlate"
import Panel from "../components/Panel"
import { usePageTitle } from "../lib/usePageTitle"

const MIN_WEEK = 1
const MAX_WEEK = 18

function MatchupsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  usePageTitle("Matchups")

  // No week in the URL means the backend's current week, which is what a
  // visitor wants on arrival. Only an explicit choice is written back.
  const param = Number(searchParams.get("week"))
  const week = param >= MIN_WEEK && param <= MAX_WEEK ? param : null
  const setWeek = (next: number) => setSearchParams({ week: String(next) }, { replace: true })

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Matchups">
        <MatchupSlate week={week} onWeekChange={setWeek} minWeek={MIN_WEEK} maxWeek={MAX_WEEK} />
      </Panel>
    </div>
  )
}

export default MatchupsPage
