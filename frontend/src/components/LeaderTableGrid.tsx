import type { LeaderCategory } from "../data/leaderTypes"
import LeaderTable from "./LeaderTable"

interface LeaderTableGridProps {
  categories: LeaderCategory[]
}

function LeaderTableGrid({ categories }: LeaderTableGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {categories.map((category) => (
        <LeaderTable key={category.title} {...category} />
      ))}
    </div>
  )
}

export default LeaderTableGrid
