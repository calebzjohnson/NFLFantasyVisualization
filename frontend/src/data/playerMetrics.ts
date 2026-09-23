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
}

function num(row: PlayerStatsRow, field: string): number {
  return Number(row[field] ?? 0)
}

function percent(row: PlayerStatsRow, field: string): number {
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

export const PLAYER_METRICS: Record<PositionGroup, PlayerMetric[]> = {
  QB: QB_METRICS,
  RB: RB_METRICS,
  WR: WR_METRICS,
  // TEs are receivers first - same metric catalog as WR.
  TE: WR_METRICS,
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
}

export function playersPathForPosition(position: PositionGroup): string {
  const fields = [...IDENTITY_FIELDS, ...RAW_FIELDS[position]]
  const params = new URLSearchParams({ position_group: position, fields: fields.join(",") })
  return `/players?${params.toString()}`
}
