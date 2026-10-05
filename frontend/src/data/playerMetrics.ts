// playerMetrics.ts
// The metric catalog for the Compare Players scatterplot (and the metric
// type/helpers the team catalog reuses): a deliberately
// wider set than the compact Stat Leaders table, since here the point is
// open-ended comparison across every player in a position, not a top-5 list.
// Verified against the real /players response (season 2026) before picking
// these - only fields that actually come back non-null for that position.
import { passerRating, perAttempt, TACKLE_FIELDS, totalTackles } from "../lib/footballStats"
import type { PositionGroup } from "./leaderCategories"

// One row from /players, restricted via ?fields=... to whatever the active
// position's metrics need, plus the identity fields every metric can use.
export type PlayerStatsRow = Record<string, string | number | null> & {
  player_id: string
  player_display_name: string
  recent_team: string
  headshot_url: string | null
}

// A metric's `value` only ever does generic field lookups (see `num`/
// `percent` below) - never touches the identity fields - so it's typed
// against the plain record shape. That lets the same metric catalog drive
// both /players rows (PlayerStatsRow) and /players/weekly rows, which carry
// `team` instead of `recent_team`.
export type StatFields = Record<string, string | number | boolean | null>

export interface PlayerMetric {
  key: string
  label: string
  unit?: string // e.g. "%" for share-based metrics; omitted for plain counts
  value: (row: StatFields) => number
}

export function num(row: StatFields, field: string): number {
  return Number(row[field] ?? 0)
}

function percent(row: StatFields, field: string): number {
  return num(row, field) * 100
}

const fantasyPointsPpr: PlayerMetric = {
  key: "fantasy_points_ppr",
  label: "Fantasy Points (PPR)",
  value: (row) => num(row, "fantasy_points_ppr"),
}

const QB_METRICS: PlayerMetric[] = [
  { key: "completions", label: "Completions", value: (row) => num(row, "completions") },
  { key: "attempts", label: "Attempts", value: (row) => num(row, "attempts") },
  {
    key: "completion_pct",
    label: "Completion %",
    unit: "%",
    value: (row) => perAttempt(num(row, "completions") * 100, num(row, "attempts")),
  },
  { key: "passing_yards", label: "Passing Yards", value: (row) => num(row, "passing_yards") },
  { key: "passing_tds", label: "Passing TDs", value: (row) => num(row, "passing_tds") },
  {
    key: "passing_interceptions",
    label: "Interceptions",
    value: (row) => num(row, "passing_interceptions"),
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
  },
  { key: "passing_epa", label: "EPA", value: (row) => num(row, "passing_epa") },
  { key: "passing_cpoe", label: "CPOE", value: (row) => num(row, "passing_cpoe") },
  { key: "sacks_suffered", label: "Sacks Taken", value: (row) => num(row, "sacks_suffered") },
  fantasyPointsPpr,
]

const RB_METRICS: PlayerMetric[] = [
  { key: "carries", label: "Carries", value: (row) => num(row, "carries") },
  { key: "rushing_yards", label: "Rushing Yards", value: (row) => num(row, "rushing_yards") },
  { key: "rushing_tds", label: "Rushing TDs", value: (row) => num(row, "rushing_tds") },
  {
    key: "ypc",
    label: "Yards / Carry",
    value: (row) => perAttempt(num(row, "rushing_yards"), num(row, "carries")),
  },
  { key: "rushing_epa", label: "Rushing EPA", value: (row) => num(row, "rushing_epa") },
  { key: "receptions", label: "Receptions", value: (row) => num(row, "receptions") },
  { key: "targets", label: "Targets", value: (row) => num(row, "targets") },
  {
    key: "receiving_yards",
    label: "Receiving Yards",
    value: (row) => num(row, "receiving_yards"),
  },
  { key: "target_share", label: "Target Share", unit: "%", value: (row) => percent(row, "target_share") },
  { key: "wopr", label: "WOPR", value: (row) => num(row, "wopr") },
  fantasyPointsPpr,
]

const WR_METRICS: PlayerMetric[] = [
  { key: "receptions", label: "Receptions", value: (row) => num(row, "receptions") },
  { key: "targets", label: "Targets", value: (row) => num(row, "targets") },
  {
    key: "receiving_yards",
    label: "Receiving Yards",
    value: (row) => num(row, "receiving_yards"),
  },
  { key: "receiving_tds", label: "Receiving TDs", value: (row) => num(row, "receiving_tds") },
  {
    key: "ypr",
    label: "Yards / Reception",
    value: (row) => perAttempt(num(row, "receiving_yards"), num(row, "receptions")),
  },
  { key: "receiving_epa", label: "EPA", value: (row) => num(row, "receiving_epa") },
  { key: "target_share", label: "Target Share", unit: "%", value: (row) => percent(row, "target_share") },
  {
    key: "air_yards_share",
    label: "Air Yards Share",
    unit: "%",
    value: (row) => percent(row, "air_yards_share"),
  },
  { key: "racr", label: "RACR", value: (row) => num(row, "racr") },
  { key: "wopr", label: "WOPR", value: (row) => num(row, "wopr") },
  fantasyPointsPpr,
]

// Defensive metrics shared across DL/LB/DB, each group picking the ones that
// fit its job. Rates use perAttempt (0 with no attempts) like the offense.
const tackles: PlayerMetric = { key: "tackles", label: "Tackles", value: totalTackles }
const soloTackles: PlayerMetric = {
  key: "def_tackles_solo",
  label: "Solo Tackles",
  value: (row) => num(row, "def_tackles_solo"),
}
const tacklesForLoss: PlayerMetric = {
  key: "def_tackles_for_loss",
  label: "Tackles for Loss",
  value: (row) => num(row, "def_tackles_for_loss"),
}
const sacks: PlayerMetric = { key: "def_sacks", label: "Sacks", value: (row) => num(row, "def_sacks") }
const qbHits: PlayerMetric = { key: "def_qb_hits", label: "QB Hits", value: (row) => num(row, "def_qb_hits") }
const pressures: PlayerMetric = { key: "def_pressures", label: "Pressures", value: (row) => num(row, "def_pressures") }
const hurries: PlayerMetric = {
  key: "def_times_hurried",
  label: "Hurries",
  value: (row) => num(row, "def_times_hurried"),
}
const forcedFumbles: PlayerMetric = {
  key: "def_fumbles_forced",
  label: "Forced Fumbles",
  value: (row) => num(row, "def_fumbles_forced"),
}
const passesDefended: PlayerMetric = {
  key: "def_pass_defended",
  label: "Passes Defended",
  value: (row) => num(row, "def_pass_defended"),
}
const interceptions: PlayerMetric = {
  key: "def_interceptions",
  label: "Interceptions",
  value: (row) => num(row, "def_interceptions"),
}
const defenseSnaps: PlayerMetric = {
  key: "defense_snaps",
  label: "Defensive Snaps",
  value: (row) => num(row, "defense_snaps"),
}
const defenseSnapPct: PlayerMetric = {
  key: "defense_snap_pct",
  label: "Snap %",
  unit: "%",
  value: (row) => num(row, "defense_snap_pct"),
}
const pressureRate: PlayerMetric = {
  key: "pressure_rate",
  label: "Pressure Rate",
  unit: "%",
  value: (row) => perAttempt(num(row, "def_pressures") * 100, num(row, "defense_snaps")),
}
const missedTacklePct: PlayerMetric = {
  key: "missed_tackle_pct",
  label: "Missed Tackle %",
  unit: "%",
  value: (row) => {
    const missed = num(row, "def_missed_tackles")
    return perAttempt(missed * 100, totalTackles(row) + missed)
  },
}
const targetsAllowed: PlayerMetric = {
  key: "def_targets",
  label: "Targets Allowed",
  value: (row) => num(row, "def_targets"),
}
const yardsAllowed: PlayerMetric = {
  key: "def_yards_allowed",
  label: "Yards Allowed",
  value: (row) => num(row, "def_yards_allowed"),
}
const ratingAllowed: PlayerMetric = {
  key: "passer_rating_allowed",
  label: "Passer Rating Allowed",
  value: (row) =>
    passerRating(
      num(row, "def_completions_allowed"),
      num(row, "def_targets"),
      num(row, "def_yards_allowed"),
      num(row, "def_receiving_td_allowed"),
      num(row, "def_interceptions"),
    ),
}

const DL_METRICS: PlayerMetric[] = [
  tackles,
  tacklesForLoss,
  sacks,
  qbHits,
  pressures,
  hurries,
  forcedFumbles,
  passesDefended,
  defenseSnaps,
  defenseSnapPct,
  pressureRate,
  missedTacklePct,
]

const LB_METRICS: PlayerMetric[] = [
  tackles,
  soloTackles,
  tacklesForLoss,
  sacks,
  pressures,
  passesDefended,
  interceptions,
  forcedFumbles,
  targetsAllowed,
  yardsAllowed,
  ratingAllowed,
  missedTacklePct,
  defenseSnaps,
]

const DB_METRICS: PlayerMetric[] = [
  tackles,
  interceptions,
  passesDefended,
  targetsAllowed,
  {
    key: "def_completions_allowed",
    label: "Completions Allowed",
    value: (row) => num(row, "def_completions_allowed"),
  },
  {
    key: "completion_pct_allowed",
    label: "Completion % Allowed",
    unit: "%",
    value: (row) => perAttempt(num(row, "def_completions_allowed") * 100, num(row, "def_targets")),
  },
  yardsAllowed,
  {
    key: "yards_per_target_allowed",
    label: "Yards / Target Allowed",
    value: (row) => perAttempt(num(row, "def_yards_allowed"), num(row, "def_targets")),
  },
  { key: "def_receiving_td_allowed", label: "TDs Allowed", value: (row) => num(row, "def_receiving_td_allowed") },
  ratingAllowed,
  missedTacklePct,
  defenseSnaps,
]

const OL_METRICS: PlayerMetric[] = [
  { key: "offense_snaps", label: "Offensive Snaps", value: (row) => num(row, "offense_snaps") },
  { key: "offense_snap_pct", label: "Snap %", unit: "%", value: (row) => num(row, "offense_snap_pct") },
  { key: "penalties", label: "Penalties", value: (row) => num(row, "penalties") },
  { key: "penalty_yards", label: "Penalty Yards", value: (row) => num(row, "penalty_yards") },
  {
    key: "penalties_per_100_snaps",
    label: "Penalties / 100 Snaps",
    value: (row) => perAttempt(num(row, "penalties") * 100, num(row, "offense_snaps")),
  },
]

const K_METRICS: PlayerMetric[] = [
  { key: "fg_made", label: "Field Goals Made", value: (row) => num(row, "fg_made") },
  { key: "fg_att", label: "Field Goal Attempts", value: (row) => num(row, "fg_att") },
  {
    key: "fg_pct",
    label: "Field Goal %",
    unit: "%",
    value: (row) => perAttempt(num(row, "fg_made") * 100, num(row, "fg_att")),
  },
  { key: "fg_long", label: "Longest Field Goal", value: (row) => num(row, "fg_long") },
  {
    key: "fg_made_50_plus",
    label: "50+ Yard FGs Made",
    value: (row) => num(row, "fg_made_50_59") + num(row, "fg_made_60_"),
  },
  { key: "pat_made", label: "Extra Points Made", value: (row) => num(row, "pat_made") },
  {
    key: "pat_pct",
    label: "Extra Point %",
    unit: "%",
    value: (row) => perAttempt(num(row, "pat_made") * 100, num(row, "pat_att")),
  },
]

const P_METRICS: PlayerMetric[] = [
  { key: "pt_att", label: "Punts", value: (row) => num(row, "pt_att") },
  { key: "gross_avg", label: "Gross Average", value: (row) => perAttempt(num(row, "pt_yards"), num(row, "pt_att")) },
  { key: "net_avg", label: "Net Average", value: (row) => perAttempt(num(row, "pt_net_yards"), num(row, "pt_att")) },
  { key: "pt_inside_20", label: "Inside the 20", value: (row) => num(row, "pt_inside_20") },
  {
    key: "inside_20_pct",
    label: "Inside the 20 %",
    unit: "%",
    value: (row) => perAttempt(num(row, "pt_inside_20") * 100, num(row, "pt_att")),
  },
  { key: "pt_touchback", label: "Touchbacks", value: (row) => num(row, "pt_touchback") },
]

// Defenders, linemen, and specialists get no Fantasy Points metric -
// nflverse's fantasy scoring only counts offensive stats, so theirs is ~0.
export const PLAYER_METRICS: Record<PositionGroup, PlayerMetric[]> = {
  QB: QB_METRICS,
  RB: RB_METRICS,
  WR: WR_METRICS,
  // TEs are receivers first - same metric catalog as WR.
  TE: WR_METRICS,
  // Edge rushers and interior linemen are separate percentile pools but share
  // the same stat catalog - both are measured on pressure and run stops.
  EDGE: DL_METRICS,
  DL: DL_METRICS,
  LB: LB_METRICS,
  DB: DB_METRICS,
  OL: OL_METRICS,
  K: K_METRICS,
  P: P_METRICS,
}

// The middle value of a metric across every player in the position - no
// mean/std-dev, so there's no jargon to explain and no need to decide who
// "qualifies": a handful of zero-carry fullbacks can't drag a median around
// the way they'd drag an average, since a median only cares about rank order,
// not how extreme the low (or high) values are.
export function metricMedian(rows: StatFields[], metric: PlayerMetric): number {
  return median(rows.map(metric.value))
}

// 0 for no values.
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
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
  TE: [
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
  EDGE: [
    ...TACKLE_FIELDS,
    "def_tackles_for_loss",
    "def_sacks",
    "def_qb_hits",
    "def_pressures",
    "def_times_hurried",
    "def_fumbles_forced",
    "def_pass_defended",
    "def_missed_tackles",
    "defense_snaps",
    "defense_snap_pct",
  ],
  DL: [
    ...TACKLE_FIELDS,
    "def_tackles_for_loss",
    "def_sacks",
    "def_qb_hits",
    "def_pressures",
    "def_times_hurried",
    "def_fumbles_forced",
    "def_pass_defended",
    "def_missed_tackles",
    "defense_snaps",
    "defense_snap_pct",
  ],
  LB: [
    ...TACKLE_FIELDS,
    "def_tackles_for_loss",
    "def_sacks",
    "def_pressures",
    "def_pass_defended",
    "def_interceptions",
    "def_fumbles_forced",
    "def_targets",
    "def_completions_allowed",
    "def_yards_allowed",
    "def_receiving_td_allowed",
    "def_missed_tackles",
    "defense_snaps",
  ],
  DB: [
    ...TACKLE_FIELDS,
    "def_interceptions",
    "def_pass_defended",
    "def_targets",
    "def_completions_allowed",
    "def_yards_allowed",
    "def_receiving_td_allowed",
    "def_missed_tackles",
    "defense_snaps",
  ],
  OL: ["offense_snaps", "offense_snap_pct", "penalties", "penalty_yards"],
  K: ["fg_made", "fg_att", "fg_long", "fg_made_50_59", "fg_made_60_", "pat_made", "pat_att"],
  P: ["pt_att", "pt_yards", "pt_net_yards", "pt_inside_20", "pt_touchback"],
}

// Each position's snap share field (% of the team's snaps on that side of the
// ball) - how much of a game a player was on the field for. Trending Players
// judges involvement by this rather than production (targets, attempts,
// kicks), which swings with scheme and game script. Kickers and punters have
// none: there's no team special-teams total to take a share of, and when they
// play has nothing to do with health. /players/weekly only.
export const SNAP_SHARE_FIELD: Record<PositionGroup, string | null> = {
  QB: "offense_snap_pct",
  RB: "offense_snap_pct",
  WR: "offense_snap_pct",
  TE: "offense_snap_pct",
  OL: "offense_snap_pct",
  EDGE: "defense_snap_pct",
  DL: "defense_snap_pct",
  LB: "defense_snap_pct",
  DB: "defense_snap_pct",
  K: null,
  P: null,
}

export function playersPathForPosition(position: PositionGroup): string {
  const fields = [...IDENTITY_FIELDS, ...RAW_FIELDS[position]]
  const params = new URLSearchParams({ position_group: position, fields: fields.join(",") })
  return `/players?${params.toString()}`
}

// Same field set as playersPathForPosition, but /players/weekly - one row
// per player per game - for the Trending Players chart. "week" is added on
// top of the identity fields; "team" (not "recent_team") comes from
// RAW_FIELDS' sibling endpoint shape, so it's just appended here, along with
// the position's snap share.
export function playersWeeklyPathForPosition(position: PositionGroup): string {
  const snapShare = SNAP_SHARE_FIELD[position]
  const fields = new Set(["player_id", "player_display_name", "team", "headshot_url", "week", ...RAW_FIELDS[position]])
  if (snapShare) fields.add(snapShare)
  const params = new URLSearchParams({ position_group: position, fields: [...fields].join(",") })
  return `/players/weekly?${params.toString()}`
}
