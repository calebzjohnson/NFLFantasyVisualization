// RankChange.tsx
// Green up / red down arrow for places moved since last week; nothing when unchanged or unknown.
function RankChange({ previous, current }: { previous: number | null | undefined; current: number }) {
  if (previous == null || previous === current) return null
  const up = previous > current
  const spots = Math.abs(previous - current)
  const label = `${up ? "Up" : "Down"} ${spots} ${spots === 1 ? "spot" : "spots"} since last week`
  return (
    <span title={label} className={`text-xs ${up ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

export default RankChange
