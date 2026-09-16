import { DUMMY_LEADERS } from "../data/dummyLeaders"
import LeaderTable from "./LeaderTable"

function StatLeaders() {
  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">
        Stat Leaders
      </h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {DUMMY_LEADERS.map((category) => (
          <LeaderTable key={category.title} {...category} />
        ))}
      </div>
    </section>
  )
}

export default StatLeaders
