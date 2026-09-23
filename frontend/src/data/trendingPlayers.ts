// trendingPlayers.ts
// Picks which players show up on the Trending Players chart: qualifies each
// player by a per-position involvement floor (so a garbage-time snap can't
// fake a "trend"), scores everyone else by the slope of the selected stat
// over their last-5-week window, and keeps only the top 5 trending up and
// top 5 trending down - a position can have 150+ players, and plotting all
// of them would be an unreadable tangle of lines.
import type { PositionGroup } from "./leaderCategories"
import type { PlayerMetric } from "./playerMetrics"

// One row from /players/weekly. Identity fields mirror PlayerStatsRow except
// `team` (that endpoint's field name; /players uses `recent_team`).
export type WeeklyPlayerRow = Record<string, string | number | null> & {
  player_id: string
  player_display_name: string
  team: string
  headshot_url: string | null
  week: number
}

// How involved a player was in a given week, by position - the stat that
// decides whether a week counts toward their trend at all. RB uses total
// touches since a receiving back's involvement isn't captured by carries alone.
const INVOLVEMENT: Record<PositionGroup, (row: WeeklyPlayerRow) => number> = {
  QB: (row) => Number(row.attempts ?? 0),
  RB: (row) => Number(row.carries ?? 0) + Number(row.targets ?? 0),
  WR: (row) => Number(row.targets ?? 0),
}

const TREND_WINDOW_WEEKS = 5
const MIN_GAMES = 2
// A player needs to average at least this fraction of the position's most-
// involved player's workload to qualify - the same bar Compare Players uses,
// so a single garbage-time series of snaps can't read as a "trend."
const QUALIFYING_FRACTION = 0.2
const MAX_LINES_PER_DIRECTION = 5

export interface TrendLine {
  id: string
  name: string
  team: string
  headshot: string | null
  slope: number
  games: { week: number; value: number }[]
}

// Ordinary least-squares slope of y against x - used instead of just
// "last week minus first week" so a bye week (a gap in week numbers, not in
// the data) doesn't distort the trend, and so it settles down as more weeks
// of data come in rather than reading as two endpoints forever.
function slope(points: { x: number; y: number }[]): number {
  const n = points.length
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n
  const numerator = points.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0)
  const denominator = points.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0)
  return denominator === 0 ? 0 : numerator / denominator
}

export function trendingPlayers(
  rows: WeeklyPlayerRow[],
  metric: PlayerMetric,
  position: PositionGroup,
): { up: TrendLine[]; down: TrendLine[] } {
  if (rows.length === 0) return { up: [], down: [] }

  const involvement = INVOLVEMENT[position]
  const latestWeek = Math.max(...rows.map((row) => row.week))
  const windowStart = latestWeek - TREND_WINDOW_WEEKS + 1

  const byPlayer = new Map<string, WeeklyPlayerRow[]>()
  for (const row of rows) {
    if (row.week < windowStart) continue
    const games = byPlayer.get(row.player_id) ?? []
    games.push(row)
    byPlayer.set(row.player_id, games)
  }

  const avgInvolvement = new Map<string, number>()
  for (const [id, games] of byPlayer) {
    avgInvolvement.set(id, games.reduce((sum, g) => sum + involvement(g), 0) / games.length)
  }
  const threshold = Math.max(0, ...avgInvolvement.values()) * QUALIFYING_FRACTION

  const lines: TrendLine[] = []
  for (const [id, games] of byPlayer) {
    if (games.length < MIN_GAMES) continue
    if ((avgInvolvement.get(id) ?? 0) < threshold) continue

    const sorted = [...games].sort((a, b) => a.week - b.week)
    const points = sorted.map((g) => ({ x: g.week, y: metric.value(g) }))
    lines.push({
      id,
      name: sorted[0].player_display_name,
      team: sorted[0].team,
      headshot: sorted[0].headshot_url,
      slope: slope(points),
      games: points.map((p) => ({ week: p.x, value: p.y })),
    })
  }

  const up = [...lines]
    .filter((line) => line.slope > 0)
    .sort((a, b) => b.slope - a.slope)
    .slice(0, MAX_LINES_PER_DIRECTION)
  const down = [...lines]
    .filter((line) => line.slope < 0)
    .sort((a, b) => a.slope - b.slope)
    .slice(0, MAX_LINES_PER_DIRECTION)

  return { up, down }
}
