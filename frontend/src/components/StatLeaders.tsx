import { DUMMY_LEADERS } from "../data/dummyLeaders"
import LeaderTableGrid from "./LeaderTableGrid"

function StatLeaders() {
  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
        Stat Leaders
      </h1>
      <LeaderTableGrid categories={DUMMY_LEADERS} />
    </section>
  )
}

export default StatLeaders
