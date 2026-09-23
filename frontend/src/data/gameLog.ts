// gameLog.ts
// Per-position column config for the player page's game log table, fed by
// /players/:id/games. Mirrors the Stat Leaders columns (leaderCategories.ts)
// so the same stats read the same way in both places.
import { passerRating, perAttempt } from "../lib/footballStats"
import type { LeaderColumn } from "./leaderStatsTypes"
import type { PositionGroup } from "./leaderCategories"

// One row from /players/:id/games - the full weekly stat line, unfiltered.
export type GameStatsRow = Record<string, string | number | null> & {
  week: number
  opponent_team: string
}

export interface GameLogConfig {
  columns: LeaderColumn[]
  toStats: (row: GameStatsRow) => Record<string, number>
  // Season-total row shown at the bottom of the table. Rate stats (CMP%, YPC,
  // rating, ...) are recomputed from the summed raw counts, not averaged
  // per-game rates - summing weekly CMP% would give a meaningless number.
  toTotals: (rows: GameStatsRow[]) => Record<string, number>
}

function num(row: GameStatsRow, field: string): number {
  return Number(row[field] ?? 0)
}

function sum(rows: GameStatsRow[], field: string): number {
  return rows.reduce((total, row) => total + num(row, field), 0)
}

// Shared by WR and TE - both are receivers with the same game log shape.
const receivingConfig: GameLogConfig = {
  columns: [
    { key: "rec", label: "REC" },
    { key: "tgt", label: "TGT" },
    { key: "yards", label: "YARDS" },
    { key: "td", label: "TD", tone: "positive" },
    { key: "ypr", label: "YPR" },
    { key: "fum", label: "FUM", tone: "negative" },
  ],
  toStats: (row) => {
    const rec = num(row, "receptions")
    const yards = num(row, "receiving_yards")
    return {
      tgt: num(row, "targets"),
      rec,
      yards,
      td: num(row, "receiving_tds"),
      ypr: perAttempt(yards, rec),
      fum: num(row, "fumbles_lost_total"),
    }
  },
  toTotals: (rows) => {
    const rec = sum(rows, "receptions")
    const yards = sum(rows, "receiving_yards")
    return {
      tgt: sum(rows, "targets"),
      rec,
      yards,
      td: sum(rows, "receiving_tds"),
      ypr: perAttempt(yards, rec),
      fum: sum(rows, "fumbles_lost_total"),
    }
  },
}

const GAME_LOG_CONFIGS: Record<PositionGroup, GameLogConfig> = {
  QB: {
    columns: [
      { key: "cmp", label: "CMP" },
      { key: "att", label: "ATT" },
      { key: "cmpPct", label: "CMP%" },
      { key: "yards", label: "YARDS" },
      { key: "td", label: "PASS TD", tone: "positive" },
      { key: "int", label: "INT", tone: "negative" },
      { key: "sacks", label: "SACK" },
      { key: "rushAtt", label: "RUSH ATT" },
      { key: "rushYards", label: "RUSH YDS" },
      { key: "rushTd", label: "RUSH TD", tone: "positive" },
      { key: "fum", label: "FUM", tone: "negative" },
      { key: "rating", label: "RATING" },
    ],
    toStats: (row) => {
      const cmp = num(row, "completions")
      const att = num(row, "attempts")
      const yards = num(row, "passing_yards")
      const td = num(row, "passing_tds")
      const int = num(row, "passing_interceptions")
      return {
        cmp,
        att,
        cmpPct: perAttempt(cmp * 100, att),
        yards,
        td,
        int,
        sacks: num(row, "sacks_suffered"),
        rushAtt: num(row, "carries"),
        rushYards: num(row, "rushing_yards"),
        rushTd: num(row, "rushing_tds"),
        fum: num(row, "fumbles_lost_total"),
        rating: passerRating(cmp, att, yards, td, int),
      }
    },
    toTotals: (rows) => {
      const cmp = sum(rows, "completions")
      const att = sum(rows, "attempts")
      const yards = sum(rows, "passing_yards")
      const td = sum(rows, "passing_tds")
      const int = sum(rows, "passing_interceptions")
      return {
        cmp,
        att,
        cmpPct: perAttempt(cmp * 100, att),
        yards,
        td,
        int,
        sacks: sum(rows, "sacks_suffered"),
        rushAtt: sum(rows, "carries"),
        rushYards: sum(rows, "rushing_yards"),
        rushTd: sum(rows, "rushing_tds"),
        fum: sum(rows, "fumbles_lost_total"),
        rating: passerRating(cmp, att, yards, td, int),
      }
    },
  },
  RB: {
    columns: [
      { key: "att", label: "RUSH ATT" },
      { key: "yards", label: "RUSH YDS" },
      { key: "td", label: "RUSH TD", tone: "positive" },
      { key: "ypc", label: "YPC" },
      { key: "rec", label: "REC" },
      { key: "recYards", label: "REC YDS" },
      { key: "recTd", label: "REC TD", tone: "positive" },
      { key: "fum", label: "FUM", tone: "negative" },
    ],
    toStats: (row) => {
      const att = num(row, "carries")
      const yards = num(row, "rushing_yards")
      return {
        att,
        yards,
        td: num(row, "rushing_tds"),
        ypc: perAttempt(yards, att),
        rec: num(row, "receptions"),
        recYards: num(row, "receiving_yards"),
        recTd: num(row, "receiving_tds"),
        fum: num(row, "fumbles_lost_total"),
      }
    },
    toTotals: (rows) => {
      const att = sum(rows, "carries")
      const yards = sum(rows, "rushing_yards")
      return {
        att,
        yards,
        td: sum(rows, "rushing_tds"),
        ypc: perAttempt(yards, att),
        rec: sum(rows, "receptions"),
        recYards: sum(rows, "receiving_yards"),
        recTd: sum(rows, "receiving_tds"),
        fum: sum(rows, "fumbles_lost_total"),
      }
    },
  },
  // TEs are receivers first - same game log shape as WR.
  WR: receivingConfig,
  TE: receivingConfig,
}

// Roster positions vary more than the site's QB/RB/WR/TE toggle (FB, ...) -
// bucket each into whichever game log shape fits its stats best.
const POSITION_BUCKET: Record<string, PositionGroup> = {
  QB: "QB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
}

export function gameLogConfigForPosition(position: string | null): GameLogConfig | null {
  if (position === null) return null
  const bucket = POSITION_BUCKET[position]
  return bucket ? GAME_LOG_CONFIGS[bucket] : null
}
