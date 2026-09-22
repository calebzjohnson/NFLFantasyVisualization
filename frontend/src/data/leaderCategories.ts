// leaderCategories.ts
// Per-category Stat Leaders config: /players query, columns, and row-to-stats mapping.
import { passerRating, perAttempt } from "../lib/footballStats"
import type { LeaderColumn } from "./leaderStatsTypes"

// One row from /players, restricted via ?fields=... to whatever a category needs
// plus the two identity fields every category asks for.
export type RawPlayerRow = Record<string, string | number> & {
  player_id: string
  player_display_name: string
  recent_team: string
}

// The position groups the player-groups page toggles between. Extending this
// list later (TE, DL, LB, CB/S, ...) means adding a matching LEADER_CATEGORIES
// entry - the toggle and Stat Leaders panel both read from this one list.
export const POSITION_GROUPS = ["QB", "RB", "WR"] as const
export type PositionGroup = (typeof POSITION_GROUPS)[number]

export interface LeaderCategoryConfig {
  key: string
  position: PositionGroup
  label: string
  path: string
  columns: LeaderColumn[]
  toStats: (row: RawPlayerRow) => Record<string, number>
  // Stats column key the table is sorted by before the user picks one.
  defaultSortKey: string
}

// Leader tables show the top 5, but any column can become the sort key once
// data reaches the browser (see StatLeadersPanel). Fetch a wider pool sorted
// by the category's default stat so re-sorting client-side by another stat
// still has real contenders to pick from, not just the top 5 by yards.
const LEADER_POOL_SIZE = 40

function playersPath(sort: string, fields: string[]): string {
  const params = new URLSearchParams({ sort, limit: String(LEADER_POOL_SIZE), fields: fields.join(",") })
  return `/players?${params.toString()}`
}

export const LEADER_CATEGORIES: LeaderCategoryConfig[] = [
  {
    key: "passing",
    position: "QB",
    label: "Passing",
    path: playersPath("-passing_yards", [
      "player_id",
      "player_display_name",
      "recent_team",
      "completions",
      "attempts",
      "passing_yards",
      "passing_tds",
      "passing_interceptions",
    ]),
    columns: [
      { key: "att", label: "ATT" },
      { key: "cmp", label: "CMP" },
      { key: "yards", label: "YARDS" },
      { key: "td", label: "TD", tone: "positive" },
      { key: "int", label: "INT", tone: "negative" },
      { key: "rating", label: "RATING" },
    ],
    defaultSortKey: "yards",
    toStats: (row) => {
      const cmp = Number(row.completions)
      const att = Number(row.attempts)
      const yards = Number(row.passing_yards)
      const td = Number(row.passing_tds)
      const int = Number(row.passing_interceptions)
      return { cmp, att, yards, td, int, rating: passerRating(cmp, att, yards, td, int) }
    },
  },
  {
    key: "receiving",
    position: "WR",
    label: "Receiving",
    path: playersPath("-receiving_yards", [
      "player_id",
      "player_display_name",
      "recent_team",
      "receptions",
      "targets",
      "receiving_yards",
      "receiving_tds",
    ]),
    columns: [
      { key: "tgt", label: "TGT" },
      { key: "rec", label: "REC" },
      { key: "yards", label: "YARDS" },
      { key: "td", label: "TD", tone: "positive" },
      { key: "ypr", label: "YPR" },
    ],
    defaultSortKey: "yards",
    toStats: (row) => {
      const rec = Number(row.receptions)
      const yards = Number(row.receiving_yards)
      return { rec, tgt: Number(row.targets), yards, td: Number(row.receiving_tds), ypr: perAttempt(yards, rec) }
    },
  },
  {
    key: "rushing",
    position: "RB",
    label: "Rushing",
    // Includes receiving stats — pass-catching volume is a big part of an RB's fantasy value.
    path: playersPath("-rushing_yards", [
      "player_id",
      "player_display_name",
      "recent_team",
      "carries",
      "rushing_yards",
      "rushing_tds",
      "receptions",
      "receiving_yards",
      "receiving_tds",
    ]),
    columns: [
      { key: "att", label: "RUSH ATT" },
      { key: "yards", label: "RUSH YDS" },
      { key: "td", label: "RUSH TD", tone: "positive" },
      { key: "ypc", label: "YPC" },
      { key: "rec", label: "REC" },
      { key: "recYards", label: "REC YDS" },
      { key: "recTd", label: "REC TD", tone: "positive" },
    ],
    defaultSortKey: "yards",
    toStats: (row) => {
      const att = Number(row.carries)
      const yards = Number(row.rushing_yards)
      return {
        att,
        yards,
        td: Number(row.rushing_tds),
        ypc: perAttempt(yards, att),
        rec: Number(row.receptions),
        recYards: Number(row.receiving_yards),
        recTd: Number(row.receiving_tds),
      }
    },
  },
]
