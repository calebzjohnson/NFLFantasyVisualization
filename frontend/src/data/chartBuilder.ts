// chartBuilder.ts
// The Create page's rules: its URL state (players or teams, chart type, picks, stats), which stats fit the picks, and the bars and lines each chart draws.
import type { PositionGroup } from "./leaderCategories"
import { meetsMinimum, PLAYER_METRICS, type PlayerMetric, type StatFields } from "./playerMetrics"
import { TEAM_METRICS } from "./teamMetrics"
import { slope, type TrendLine } from "./trendingPlayers"
import { CATEGORICAL_PALETTE } from "./usage"

// One chart never mixes players and teams: their stat catalogs don't overlap.
export const BUILDER_KINDS = ["players", "teams"] as const
export type BuilderKind = (typeof BUILDER_KINDS)[number]

export const CHART_TYPES = ["bar", "line"] as const
export type ChartType = (typeof CHART_TYPES)[number]

// More lines than this turn into a tangle (Trending stops at 5 each way too),
// and it keeps every pick inside the palette without repeating a color.
export const MAX_PICKS = 5
// A bar chart draws one small chart per stat; a line chart has one y-axis.
export const MAX_STATS: Record<ChartType, number> = { bar: 4, line: 1 }

export interface BuilderState {
  kind: BuilderKind
  type: ChartType
  ids: string[] // player ids or team abbreviations, in the order picked
  // Metric keys. null when none were ever picked (draw the default); [] when
  // the user turned them all off (a bar chart then draws nothing).
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

const DEFAULT_STAT = "fantasy_points_ppr"

// The stats to draw: the picked ones that are available, up to the chart's
// limit. A bar chart the user cleared draws none. Otherwise, with none
// available - never picked, a line chart (it needs one), or a shared link
// whose stats this mix doesn't have - fantasy points (else the first stat).
export function chartStats(state: BuilderState, metrics: PlayerMetric[]): PlayerMetric[] {
  if (state.type === "bar" && state.stats?.length === 0) return []
  const picked = (state.stats ?? [])
    .map((key) => metrics.find((metric) => metric.key === key))
    .filter((metric) => metric !== undefined)
    .slice(0, MAX_STATS[state.type])
  if (picked.length > 0) return picked
  const fallback = metrics.find((metric) => metric.key === DEFAULT_STAT) ?? metrics[0]
  return fallback ? [fallback] : []
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
