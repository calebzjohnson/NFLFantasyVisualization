// leaderCategories.ts
// Per-category Stat Leaders config: /players query, columns, and row-to-stats mapping.
import { passerRating, perAttempt } from "../lib/footballStats"
import type { LeaderColumn } from "./leaderStatsTypes"

// One row from /players, restricted via ?fields=... to whatever a category needs
// plus the two identity fields every category asks for.
export type RawPlayerRow = Record<string, string | number> & {
  player_display_name: string
  recent_team: string
}

export interface LeaderCategoryConfig {
  key: string
  label: string
  path: string
  columns: LeaderColumn[]
  toStats: (row: RawPlayerRow) => Record<string, number>
}

function playersPath(sort: string, fields: string[]): string {
  const params = new URLSearchParams({ sort, limit: "5", fields: fields.join(",") })
  return `/players?${params.toString()}`
}

export const LEADER_CATEGORIES: LeaderCategoryConfig[] = [
  {
    key: "passing",
    label: "Passing",
    path: playersPath("-passing_yards", [
      "player_display_name",
      "recent_team",
      "completions",
      "attempts",
      "passing_yards",
      "passing_tds",
      "passing_interceptions",
    ]),
    columns: [
      { key: "cmp", label: "CMP" },
      { key: "att", label: "ATT" },
      { key: "yards", label: "YARDS" },
      { key: "td", label: "TD" },
      { key: "int", label: "INT" },
      { key: "rating", label: "RATING" },
    ],
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
    label: "Receiving",
    path: playersPath("-receiving_yards", [
      "player_display_name",
      "recent_team",
      "receptions",
      "targets",
      "receiving_yards",
      "receiving_tds",
    ]),
    columns: [
      { key: "rec", label: "REC" },
      { key: "tgt", label: "TGT" },
      { key: "yards", label: "YARDS" },
      { key: "td", label: "TD" },
      { key: "ypr", label: "YPR" },
    ],
    toStats: (row) => {
      const rec = Number(row.receptions)
      const yards = Number(row.receiving_yards)
      return { rec, tgt: Number(row.targets), yards, td: Number(row.receiving_tds), ypr: perAttempt(yards, rec) }
    },
  },
  {
    key: "rushing",
    label: "Rushing",
    // Includes receiving stats — pass-catching volume is a big part of an RB's fantasy value.
    path: playersPath("-rushing_yards", [
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
      { key: "td", label: "RUSH TD" },
      { key: "ypc", label: "YPC" },
      { key: "rec", label: "REC" },
      { key: "recYards", label: "REC YDS" },
      { key: "recTd", label: "REC TD" },
    ],
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
