// leaderMovement.ts
// Where each stat leader ranked going into the newest week, for the home page's movement arrows.
import type { LeaderCategoryConfig, RawPlayerRow } from "./leaderCategories"

// /players identity fields that /players/weekly doesn't have (it says `team`, not `recent_team`) or the ranking doesn't need.
const DISPLAY_FIELDS = ["player_display_name", "recent_team", "headshot_url"]

// The category's /players query as /players/weekly: the same stat fields, one row per player per game.
// ponytail: ships every game row (~370KB for WRs by Week 17); move the
// before-week totals server-side if the home page's load time suffers.
export function weeklyLeaderPath(category: LeaderCategoryConfig): string {
  const query = new URLSearchParams(category.path.slice(category.path.indexOf("?") + 1))
  const fields = query
    .get("fields")!
    .split(",")
    .filter((field) => !DISPLAY_FIELDS.includes(field))
  const params = new URLSearchParams({ position_group: query.get("position_group")!, fields: [...fields, "week"].join(",") })
  return `/players/weekly?${params.toString()}`
}

// Ranks by value, highest first, with tied players sharing a place ("1, 2, 2, 4") -
// so a tie that happens to break differently from one week to the next isn't shown as movement.
export function competitionRanks(values: Map<string, number>): Map<string, number> {
  const sorted = [...values.values()].sort((a, b) => b - a)
  return new Map([...values].map(([id, value]) => [id, sorted.findIndex((other) => other <= value) + 1]))
}

// Each of `playerIds`' place on the category's headline stat going into
// `latestWeek`, rebuilt by summing their games before it. A player with no
// earlier games counts as 0. Null when there's no earlier week to compare to.
// Summed counts are exact for every headline stat; max-type fields like
// fg_long come out wrong, but no headline stat uses one.
export function previousRanks(
  category: LeaderCategoryConfig,
  playerIds: string[],
  weekly: RawPlayerRow[],
  latestWeek: number,
): Map<string, number> | null {
  const earlier = weekly.filter((row) => Number(row.week) < latestWeek)
  if (earlier.length === 0) return null

  const totals = new Map<string, Record<string, number>>()
  for (const row of earlier) {
    const total = totals.get(row.player_id) ?? {}
    for (const [field, value] of Object.entries(row)) {
      if (typeof value === "number") total[field] = (total[field] ?? 0) + value
    }
    totals.set(row.player_id, total)
  }

  const key = category.defaultSortKey
  return competitionRanks(
    new Map(
      playerIds.map((id) => {
        const total = totals.get(id)
        // || 0: a field that was null in every game sums to missing, and toStats turns that into NaN.
        return [id, total ? category.toStats(total as RawPlayerRow)[key] || 0 : 0]
      }),
    ),
  )
}
