// PlayerPage.tsx
// Individual player route: placeholder until game-log visualizations land.
import { useLocation } from "react-router-dom"

function PlayerPage() {
  const { state } = useLocation() as { state?: { playerName?: string } }
  const title = state?.playerName ?? "Player"

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-wide text-[var(--text-primary)] uppercase">
        {title}
      </h1>
      <p className="mt-2 text-[var(--text-secondary)]">Coming soon.</p>
    </div>
  )
}

export default PlayerPage
