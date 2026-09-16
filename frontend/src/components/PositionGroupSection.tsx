import type { LeaderCategory } from "../data/leaderTypes"
import LeaderTableGrid from "./LeaderTableGrid"

interface PositionGroupSectionProps {
  title: string
  categories: LeaderCategory[]
}

function PositionGroupSection({ title, categories }: PositionGroupSectionProps) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <LeaderTableGrid categories={categories} />
    </section>
  )
}

export default PositionGroupSection
