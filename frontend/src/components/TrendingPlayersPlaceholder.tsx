// TrendingPlayersPlaceholder.tsx
// Placeholder for a multi-line chart of trending players (e.g. the top 3
// trending up and down) at the active position, tracked over the season's
// weeks. Not wired to real data yet. Same aspect ratio as Compare Players.
import type { PositionGroup } from "../data/leaderCategories"
import Panel from "./Panel"

function TrendingPlayersPlaceholder({ position }: { position: PositionGroup }) {
  return (
    <Panel title="Trending Players">
      <div className="m-4 flex aspect-[3/2] items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)]">
        <p className="max-w-xs px-4 text-center text-sm text-[var(--text-muted)]">
          Weekly trend chart coming soon — the {position}s trending up or down the most this
          season.
        </p>
      </div>
    </Panel>
  )
}

export default TrendingPlayersPlaceholder
