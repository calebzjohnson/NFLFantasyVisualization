// trendingPlayers.ts
// Picks which players show up on the Trending Players chart: drops games a
// player left early (by snap share), qualifies each player by a snap share
// floor (so garbage-time snaps can't fake a "trend") and by having played
// recently (so an injured player doesn't linger), scores everyone else by
// the slope of the selected stat over their last-5-week window, and keeps
// only the top 5 trending up and top 5 trending down - a position can have 150+ players, and plotting all
// of them would be an unreadable tangle of lines.
import type { PositionGroup } from "./leaderCategories"
import { median, SNAP_SHARE_FIELD, type PlayerMetric } from "./playerMetrics"

// One row from /players/weekly. Identity fields mirror PlayerStatsRow except
// `team` (that endpoint's field name; /players uses `recent_team`).
export type WeeklyPlayerRow = Record<string, string | number | null> & {
  player_id: string
  player_display_name: string
  team: string
  headshot_url: string | null
  week: number
}

const TREND_WINDOW_WEEKS = 5
const MIN_GAMES = 2
// A player must have played in one of the last this-many weeks to trend, so
// someone injured and out drops off within two weeks instead of lingering
// for the whole window on the games before the injury. Two, not one, so a
// bye in the latest week doesn't knock anyone off. Only the end of the
// window matters - a practice-squad call-up with no early games still counts.
const RECENT_WEEKS = 2
// A game counts only if the player was on the field for at least this
// fraction of their usual (median) snap share - a game left early to injury
// would otherwise swing the slope as if it were a real slump. Median, not
// their busiest game, so one heavy fill-in game doesn't make a part-timer's
// normal games all look cut short.
const FULL_GAME_FRACTION = 0.5
// Average snap share (%) a player needs over their counted games to qualify,
// so a backup's garbage-time snaps can't read as a "trend."
const MIN_AVG_SNAP_SHARE = 20
const MAX_LINES_PER_DIRECTION = 5

export interface TrendLine {
  id: string
  name: string
  team: string
  headshot: string | null
  logo?: string // teams get a logo badge instead of initials
  slope: number
  games: { week: number; value: number }[]
}

// Ordinary least-squares slope of y against x - used instead of just
// "last week minus first week" so a bye week (a gap in week numbers, not in
// the data) doesn't distort the trend, and so it settles down as more weeks
// of data come in rather than reading as two endpoints forever.
export function slope(points: { x: number; y: number }[]): number {
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

  const shareField = SNAP_SHARE_FIELD[position]
  const latestWeek = Math.max(...rows.map((row) => row.week))
  const windowStart = latestWeek - TREND_WINDOW_WEEKS + 1

  const byPlayer = new Map<string, WeeklyPlayerRow[]>()
  for (const row of rows) {
    if (row.week < windowStart) continue
    const games = byPlayer.get(row.player_id) ?? []
    games.push(row)
    byPlayer.set(row.player_id, games)
  }

  const lines: TrendLine[] = []
  for (const [id, played] of byPlayer) {
    const games = shareField ? fullGames(played, shareField) : played
    if (games.length < MIN_GAMES) continue
    if (shareField && averageShare(games, shareField) < MIN_AVG_SNAP_SHARE) continue

    const sorted = [...games].sort((a, b) => a.week - b.week)
    if (sorted[sorted.length - 1].week <= latestWeek - RECENT_WEEKS) continue
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

  return topTrends(lines)
}

// null when snap counts haven't been published for that game yet.
function snapShare(row: WeeklyPlayerRow, field: string): number | null {
  const value = row[field]
  return value === null || value === undefined ? null : Number(value)
}

function knownShares(games: WeeklyPlayerRow[], field: string): number[] {
  return games.map((g) => snapShare(g, field)).filter((share) => share !== null)
}

// Games without snap counts yet are kept - there's nothing to judge them by.
function fullGames(games: WeeklyPlayerRow[], field: string): WeeklyPlayerRow[] {
  const cutoff = median(knownShares(games, field)) * FULL_GAME_FRACTION
  return games.filter((g) => (snapShare(g, field) ?? cutoff) >= cutoff)
}

// Infinity (always qualifies) when no game has snap counts yet.
function averageShare(games: WeeklyPlayerRow[], field: string): number {
  const shares = knownShares(games, field)
  return shares.length === 0 ? Infinity : shares.reduce((sum, s) => sum + s, 0) / shares.length
}

// The steepest MAX_LINES_PER_DIRECTION lines each way; flat lines are neither.
export function topTrends(lines: TrendLine[]): { up: TrendLine[]; down: TrendLine[] } {
  const up = lines
    .filter((line) => line.slope > 0)
    .sort((a, b) => b.slope - a.slope)
    .slice(0, MAX_LINES_PER_DIRECTION)
  const down = lines
    .filter((line) => line.slope < 0)
    .sort((a, b) => a.slope - b.slope)
    .slice(0, MAX_LINES_PER_DIRECTION)
  return { up, down }
}
