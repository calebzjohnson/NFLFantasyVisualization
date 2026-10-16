// chartBuilder.ts
// The Create page's rules: its URL state (players or teams, chart type, picks, stats), which stats fit the picks, and the bars, lines, and beeswarm columns each chart draws.
import type { PositionGroup } from "./leaderCategories"
import { formatValue, meetsMinimum, num, PLAYER_METRICS, type PlayerMetric, type StatFields } from "./playerMetrics"
import { TEAM_METRICS } from "./teamMetrics"
import { slope, type TrendLine } from "./trendingPlayers"
import { CATEGORICAL_PALETTE } from "./usage"

// One chart never mixes players and teams: their stat catalogs don't overlap.
export const BUILDER_KINDS = ["players", "teams"] as const
export type BuilderKind = (typeof BUILDER_KINDS)[number]

export const CHART_TYPES = ["bar", "line", "scatter", "beeswarm"] as const
export type ChartType = (typeof CHART_TYPES)[number]

// More lines than this turn into a tangle (Trending stops at 5 each way too),
// and it keeps every pick inside the palette without repeating a color.
export const MAX_PICKS = 5
// A bar chart draws one small chart per stat, a line chart has one y-axis, a
// scatter exactly two, and a beeswarm a column per stat (six fit on screen,
// as on the player page).
export const MAX_STATS: Record<ChartType, number> = { bar: 4, line: 1, scatter: 2, beeswarm: 6 }
// How many stats a chart draws before any are picked.
const DEFAULT_COUNT: Record<ChartType, number> = { bar: 1, line: 1, scatter: 2, beeswarm: 3 }

export interface BuilderState {
  kind: BuilderKind
  type: ChartType
  ids: string[] // player ids or team abbreviations, in the order picked
  // Metric keys (a scatter's are x, then y). null when none were ever picked
  // (draw the defaults); [] when the user turned them all off (a bar chart
  // or beeswarm then draws nothing).
  stats: string[] | null
}

// A player or team the user picked, with what the charts show for it.
export interface Picked {
  id: string
  name: string
  team: string
  href: string
  logo?: string
}

export interface BarRow extends Picked {
  color: string
  values: Record<string, number | null> // metric key -> value; null with no stats row
  // metric key -> plays counted, for stats where this pick is under the
  // stat's minimum sample (see MinSample) - drawn, but flagged.
  smallSamples: Record<string, number>
}

function oneOf<T extends string>(options: readonly T[], value: string | null): T {
  return options.includes(value as T) ? (value as T) : options[0]
}

function list(value: string | null): string[] {
  return [...new Set((value ?? "").split(",").filter(Boolean))]
}

// The URL is user-editable: anything unrecognized falls back to the default,
// and extra picks past the limit are dropped. Ids and stats are checked
// against real data later, once it has loaded.
export function parseBuilder(params: URLSearchParams): BuilderState {
  return {
    kind: oneOf(BUILDER_KINDS, params.get("kind")),
    type: oneOf(CHART_TYPES, params.get("type")),
    ids: list(params.get("ids")).slice(0, MAX_PICKS),
    stats: params.has("stats") ? list(params.get("stats")) : null,
  }
}

export function builderParams(state: BuilderState): Record<string, string> {
  const params: Record<string, string> = { kind: state.kind, type: state.type }
  if (state.ids.length > 0) params.ids = state.ids.join(",")
  // An empty stats= is kept: it's the "none picked" choice, not the default.
  if (state.stats !== null) params.stats = state.stats.join(",")
  return params
}

// Every team stat for teams. For players, the stats every picked player's
// position has, in the first pick's order - a WR and an RB share the receiving
// and fantasy stats, and a QB-only stat drops out once a WR joins.
export function availableMetrics(kind: BuilderKind, groups: PositionGroup[]): PlayerMetric[] {
  if (kind === "teams") return TEAM_METRICS
  if (groups.length === 0) return []
  const [first, ...rest] = groups
  return PLAYER_METRICS[first].filter((metric) =>
    rest.every((group) => PLAYER_METRICS[group].some((other) => other.key === metric.key)),
  )
}

// Defaults come from these first, then the catalog's own order: fantasy
// points for players, and points scored vs. allowed for teams (as on Compare Teams).
const PREFERRED_STATS = ["fantasy_points_ppr", "points", "points_allowed"]

// The stats to draw: the picked ones that are available, up to the chart's
// limit. A bar chart or beeswarm the user cleared draws none. With none
// available - never picked, or a shared link whose stats this mix doesn't
// have - the defaults; and a scatter tops up to its two axes.
export function chartStats(state: BuilderState, metrics: PlayerMetric[]): PlayerMetric[] {
  const multi = state.type === "bar" || state.type === "beeswarm"
  if (multi && state.stats?.length === 0) return []
  const picked = (state.stats ?? [])
    .map((key) => metrics.find((metric) => metric.key === key))
    .filter((metric) => metric !== undefined)
    .slice(0, MAX_STATS[state.type])
  const count = state.type === "scatter" ? 2 : picked.length > 0 ? picked.length : DEFAULT_COUNT[state.type]
  const preferred = PREFERRED_STATS.flatMap((key) => metrics.find((metric) => metric.key === key) ?? [])
  const fill = [...new Set([...preferred, ...metrics])].filter((metric) => !picked.includes(metric))
  return [...picked, ...fill].slice(0, count)
}

// By pick order, so a pick keeps its color when switching chart types.
export function pickColor(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length]
}

// One row per pick, in pick order. A pick with no season stats row still
// gets a row, with no values, so it doesn't silently vanish from the chart.
export function barRows(picked: Picked[], rowById: Map<string, StatFields>, metrics: PlayerMetric[]): BarRow[] {
  return picked.map((pick, i) => {
    const row = rowById.get(pick.id)
    return {
      ...pick,
      color: pickColor(i),
      values: Object.fromEntries(metrics.map((metric) => [metric.key, row ? metric.value(row) : null])),
      smallSamples: Object.fromEntries(
        metrics.flatMap((metric) =>
          row && metric.minSample && !meetsMinimum(row, metric) ? [[metric.key, metric.minSample.count(row)]] : [],
        ),
      ),
    }
  })
}

// Who's in the beeswarm's percentile pool: the radar profiles' own volume
// floors, per week of the season so far (MIN_SAMPLE_PER_WEEK and its fields
// in backend/app/services/radar.py), so a column ranks the regulars at a
// position rather than every backup who touched the ball. Positions without
// a profile (OL, K, P) have no floor and rank everyone.
// ponytail: copied from the backend; keep the two in step if either changes,
// or serve the floors from the API if they start moving often.
const POOL_FLOOR_PER_WEEK: Partial<Record<PositionGroup, { field: string; noun: string; perWeek: number }>> = {
  QB: { field: "attempts", noun: "pass attempts", perWeek: 6.25 },
  RB: { field: "carries", noun: "carries", perWeek: 3 },
  WR: { field: "targets", noun: "targets", perWeek: 2 },
  TE: { field: "targets", noun: "targets", perWeek: 1.25 },
  EDGE: { field: "defense_snaps", noun: "defensive snaps", perWeek: 15 },
  DL: { field: "defense_snaps", noun: "defensive snaps", perWeek: 15 },
  LB: { field: "defense_snaps", noun: "defensive snaps", perWeek: 15 },
  CB: { field: "defense_snaps", noun: "defensive snaps", perWeek: 15 },
  S: { field: "defense_snaps", noun: "defensive snaps", perWeek: 15 },
}

// A position's floor at `week` (how far into the season we are), or null for none.
export function poolFloor(group: PositionGroup, week: number) {
  const floor = POOL_FLOOR_PER_WEEK[group]
  return floor ? { ...floor, min: floor.perWeek * week } : null
}

export function meetsPoolFloor(row: StatFields, group: PositionGroup, week: number): boolean {
  const floor = poolFloor(group, week)
  return !floor || num(row, floor.field) >= floor.min
}

// The regular-season week the floors scale by, from /players/latest-week:
// postseason weeks run past 18, but the floors only count the regular season.
export function seasonWeek(latest: { week: number; season_type: string }): number {
  return latest.season_type === "REG" ? latest.week : 18
}

// A row in the beeswarm's pool: a player or team and its season stats.
export interface PoolRow {
  id: string
  name: string
  team: string
  row: StatFields
}

// The beeswarm's rows: a column per stat, each cell the stat's value
// (formatted) and its percentile among everyone ranked on it. A per-play stat
// ranks only those meeting its minimum, plus the picks (drawn anyway); anyone
// else gets no dot in that column. Percentiles match the radar's (pandas'
// rank(pct=True), ties averaged): the best is 100 and the worst 100/n, with
// lower-is-better stats ranked in reverse so higher always means better.
export function percentileColumns(
  pool: PoolRow[],
  metrics: PlayerMetric[],
  pinnedIds: ReadonlySet<string>,
): { id: string; name: string; team: string; axes: { key: string; value: string | null; percentile: number | null }[] }[] {
  const columns = metrics.map((metric) => {
    const ranked = pool.filter((entry) => pinnedIds.has(entry.id) || meetsMinimum(entry.row, metric))
    const sign = metric.lowerIsBetter ? -1 : 1
    const scores = ranked.map((entry) => metric.value(entry.row) * sign)
    // ponytail: compares every pair (n² per stat); fine for a position's couple
    // hundred players, sort once and binary-search if pools ever grow far past that.
    const percentileById = new Map(
      ranked.map((entry, i) => {
        const below = scores.filter((score) => score < scores[i]).length
        const tied = scores.filter((score) => score === scores[i]).length
        return [entry.id, ((below + (tied + 1) / 2) / ranked.length) * 100]
      }),
    )
    return { metric, percentileById }
  })
  return pool.map((entry) => ({
    id: entry.id,
    name: entry.name,
    team: entry.team,
    axes: columns.map(({ metric, percentileById }) => {
      const percentile = percentileById.get(entry.id) ?? null
      return {
        key: metric.key,
        value: percentile === null ? null : formatValue(metric.value(entry.row), metric),
        percentile,
      }
    }),
  }))
}

// One line per pick over every game this season, in week order (Trending
// looks at a recent window; here the user chose who to see, so show it all).
// `idField` is the column games are keyed by: player_id, or team for teams.
// A pick with no games yet has no line.
export function pickedLines(
  picked: Picked[],
  games: StatFields[],
  idField: "player_id" | "team",
  metric: PlayerMetric,
): TrendLine[] {
  return picked.flatMap((pick, i) => {
    const points = games
      .filter((game) => game[idField] === pick.id)
      .map((game) => ({ x: Number(game.week), y: metric.value(game) }))
      .sort((a, b) => a.x - b.x)
    if (points.length === 0) return []
    return [
      {
        id: pick.id,
        name: pick.name,
        team: pick.team,
        headshot: null,
        logo: pick.logo,
        color: pickColor(i),
        slope: slope(points),
        games: points.map((point) => ({ week: point.x, value: point.y })),
      },
    ]
  })
}
