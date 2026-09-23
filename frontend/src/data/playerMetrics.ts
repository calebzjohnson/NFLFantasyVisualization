// playerMetrics.ts
// The metric catalog for the Compare Players scatterplot: a deliberately
// wider set than the compact Stat Leaders table, since here the point is
// open-ended comparison across every player in a position, not a top-5 list.
// Verified against the real /players response (season 2026) before picking
// these - only fields that actually come back non-null for that position.
import { passerRating, perAttempt } from "../lib/footballStats"
import type { PositionGroup } from "./leaderCategories"

// One row from /players, restricted via ?fields=... to whatever the active
// position's metrics need, plus the identity fields every metric can use.
export type PlayerStatsRow = Record<string, string | number | null> & {
  player_id: string
  player_display_name: string
  recent_team: string
  headshot_url: string | null
}

export interface PlayerMetric {
  key: string
  label: string
  unit?: string // e.g. "%" for share-based metrics; omitted for plain counts
  value: (row: PlayerStatsRow) => number
  // Raw workload stat (attempts/carries/targets/touches) this metric's league-
  // average reference is qualified by - see qualifiedStats() in
  // PlayerComparisonScatter. A QB who's thrown 1 pass shouldn't count toward
  // the completion-% (or interception, or anything else) average just because
  // the number happens to be a plain count instead of a percentage - a low
  // count from no opportunity is exactly as distorting as a wild rate is.
  qualifier: (row: PlayerStatsRow) => number
}

function num(row: PlayerStatsRow, field: string): number {
  return Number(row[field] ?? 0)
}

function percent(row: PlayerStatsRow, field: string): number {
  return num(row, field) * 100
}

const attempts = (row: PlayerStatsRow) => num(row, "attempts")
const carries = (row: PlayerStatsRow) => num(row, "carries")
const targets = (row: PlayerStatsRow) => num(row, "targets")
const touches = (row: PlayerStatsRow) => num(row, "carries") + num(row, "targets")

const QB_METRICS: PlayerMetric[] = [
  { key: "passing_yards", label: "Passing Yards", value: (row) => num(row, "passing_yards"), qualifier: attempts },
  { key: "passing_tds", label: "Passing TDs", value: (row) => num(row, "passing_tds"), qualifier: attempts },
  {
    key: "passing_interceptions",
    label: "Interceptions",
    value: (row) => num(row, "passing_interceptions"),
    qualifier: attempts,
  },
  { key: "completions", label: "Completions", value: (row) => num(row, "completions"), qualifier: attempts },
  { key: "attempts", label: "Attempts", value: (row) => num(row, "attempts"), qualifier: attempts },
  {
    key: "completion_pct",
    label: "Completion %",
    unit: "%",
    value: (row) => perAttempt(num(row, "completions") * 100, num(row, "attempts")),
    qualifier: attempts,
  },
  {
    key: "rating",
    label: "Passer Rating",
    value: (row) =>
      passerRating(
        num(row, "completions"),
        num(row, "attempts"),
        num(row, "passing_yards"),
        num(row, "passing_tds"),
        num(row, "passing_interceptions"),
      ),
    qualifier: attempts,
  },
  { key: "passing_epa", label: "EPA", value: (row) => num(row, "passing_epa"), qualifier: attempts },
  { key: "passing_cpoe", label: "CPOE", value: (row) => num(row, "passing_cpoe"), qualifier: attempts },
  {
    key: "sacks_suffered",
    label: "Sacks Taken",
    value: (row) => num(row, "sacks_suffered"),
    qualifier: attempts,
  },
  {
    key: "fantasy_points_ppr",
    label: "Fantasy Points (PPR)",
    value: (row) => num(row, "fantasy_points_ppr"),
    qualifier: attempts,
  },
]

const RB_METRICS: PlayerMetric[] = [
  { key: "carries", label: "Carries", value: (row) => num(row, "carries"), qualifier: carries },
  {
    key: "rushing_yards",
    label: "Rushing Yards",
    value: (row) => num(row, "rushing_yards"),
    qualifier: carries,
  },
  { key: "rushing_tds", label: "Rushing TDs", value: (row) => num(row, "rushing_tds"), qualifier: carries },
  {
    key: "ypc",
    label: "Yards / Carry",
    value: (row) => perAttempt(num(row, "rushing_yards"), num(row, "carries")),
    qualifier: carries,
  },
  { key: "rushing_epa", label: "Rushing EPA", value: (row) => num(row, "rushing_epa"), qualifier: carries },
  { key: "receptions", label: "Receptions", value: (row) => num(row, "receptions"), qualifier: targets },
  { key: "targets", label: "Targets", value: (row) => num(row, "targets"), qualifier: targets },
  {
    key: "receiving_yards",
    label: "Receiving Yards",
    value: (row) => num(row, "receiving_yards"),
    qualifier: targets,
  },
  {
    key: "target_share",
    label: "Target Share",
    unit: "%",
    value: (row) => percent(row, "target_share"),
    qualifier: targets,
  },
  { key: "wopr", label: "WOPR", value: (row) => num(row, "wopr"), qualifier: targets },
  {
    key: "fantasy_points_ppr",
    label: "Fantasy Points (PPR)",
    value: (row) => num(row, "fantasy_points_ppr"),
    qualifier: touches,
  },
]

const WR_METRICS: PlayerMetric[] = [
  { key: "receptions", label: "Receptions", value: (row) => num(row, "receptions"), qualifier: targets },
  { key: "targets", label: "Targets", value: (row) => num(row, "targets"), qualifier: targets },
  {
    key: "receiving_yards",
    label: "Receiving Yards",
    value: (row) => num(row, "receiving_yards"),
    qualifier: targets,
  },
  {
    key: "receiving_tds",
    label: "Receiving TDs",
    value: (row) => num(row, "receiving_tds"),
    qualifier: targets,
  },
  {
    key: "ypr",
    label: "Yards / Reception",
    value: (row) => perAttempt(num(row, "receiving_yards"), num(row, "receptions")),
    qualifier: targets,
  },
  { key: "receiving_epa", label: "EPA", value: (row) => num(row, "receiving_epa"), qualifier: targets },
  {
    key: "target_share",
    label: "Target Share",
    unit: "%",
    value: (row) => percent(row, "target_share"),
    qualifier: targets,
  },
  {
    key: "air_yards_share",
    label: "Air Yards Share",
    unit: "%",
    value: (row) => percent(row, "air_yards_share"),
    qualifier: targets,
  },
  { key: "racr", label: "RACR", value: (row) => num(row, "racr"), qualifier: targets },
  { key: "wopr", label: "WOPR", value: (row) => num(row, "wopr"), qualifier: targets },
  {
    key: "fantasy_points_ppr",
    label: "Fantasy Points (PPR)",
    value: (row) => num(row, "fantasy_points_ppr"),
    qualifier: targets,
  },
]

export const PLAYER_METRICS: Record<PositionGroup, PlayerMetric[]> = {
  QB: QB_METRICS,
  RB: RB_METRICS,
  WR: WR_METRICS,
}

// A player needs at least this fraction of the position's current workload
// leader (in the metric's own `qualifier` stat) to count toward the average
// the chart centers on.
const QUALIFYING_FRACTION = 0.2

export interface MetricStats {
  mean: number
  stddev: number
}

// The league-average reference a metric's chart axis is centered on. See the
// `qualifier` field on PlayerMetric for why this excludes small-sample noise
// (a backup QB's one pass) rather than just averaging every row.
export function qualifiedStats(rows: PlayerStatsRow[], metric: PlayerMetric): MetricStats {
  if (rows.length === 0) return { mean: 0, stddev: 1 }
  const maxQualifier = Math.max(0, ...rows.map(metric.qualifier))
  const threshold = Math.round(maxQualifier * QUALIFYING_FRACTION)
  const qualified = rows.filter((row) => metric.qualifier(row) >= threshold)
  const pool = qualified.length > 0 ? qualified : rows
  const values = pool.map(metric.value)
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  // Guard against a zero-spread pool (e.g. only one qualifier) collapsing every z-score to +/-Infinity.
  return { mean, stddev: Math.sqrt(variance) || 1 }
}

// How many standard deviations `value` sits from the qualified-pool mean.
export function zScore(value: number, stats: MetricStats): number {
  return (value - stats.mean) / stats.stddev
}

// Raw /players fields needed to compute every metric above for a position -
// separate from the metric list itself, since several metrics (rating, ypc,
// completion %) are derived from more than one raw field.
const IDENTITY_FIELDS = ["player_id", "player_display_name", "recent_team", "headshot_url"]

const RAW_FIELDS: Record<PositionGroup, string[]> = {
  QB: [
    "completions",
    "attempts",
    "passing_yards",
    "passing_tds",
    "passing_interceptions",
    "passing_epa",
    "passing_cpoe",
    "sacks_suffered",
    "fantasy_points_ppr",
  ],
  RB: [
    "carries",
    "rushing_yards",
    "rushing_tds",
    "rushing_epa",
    "receptions",
    "targets",
    "receiving_yards",
    "target_share",
    "wopr",
    "fantasy_points_ppr",
  ],
  WR: [
    "receptions",
    "targets",
    "receiving_yards",
    "receiving_tds",
    "receiving_epa",
    "target_share",
    "air_yards_share",
    "racr",
    "wopr",
    "fantasy_points_ppr",
  ],
}

export function playersPathForPosition(position: PositionGroup): string {
  const fields = [...IDENTITY_FIELDS, ...RAW_FIELDS[position]]
  const params = new URLSearchParams({ position_group: position, fields: fields.join(",") })
  return `/players?${params.toString()}`
}
