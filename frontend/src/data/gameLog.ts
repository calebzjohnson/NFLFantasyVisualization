// gameLog.ts
// Per-position column config for the player page's game log table, fed by
// /players/:id/games, plus the roster-position -> position-group mapping.
// Mirrors the Stat Leaders columns (leaderCategories.ts) so the same stats
// read the same way in both places.
import { passerRating, perAttempt, totalTackles } from "../lib/footballStats"
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

// Every numeric field summed across games, as one row. Configs whose stats
// are all counts or ratios of counts reuse their per-game toStats on this for
// the season totals row - so rates come out of summed counts, not averaged.
function summedRow(rows: GameStatsRow[]): GameStatsRow {
  const totals: Record<string, number> = {}
  for (const row of rows) {
    for (const [field, value] of Object.entries(row)) {
      if (typeof value === "number") totals[field] = (totals[field] ?? 0) + value
    }
  }
  return { ...totals, week: 0, opponent_team: "" }
}

function snapPct(row: GameStatsRow, side: "offense" | "defense"): number {
  return perAttempt(num(row, `${side}_snaps`) * 100, num(row, `${side}_team_snaps`))
}

// Stat-only config (no custom totals) -> full config with summed-row totals.
function fromCounts(columns: LeaderColumn[], toStats: GameLogConfig["toStats"]): GameLogConfig {
  return { columns, toStats, toTotals: (rows) => toStats(summedRow(rows)) }
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

// Edge rushers and interior linemen keep separate percentile pools but log the
// same box score.
function defensiveLineLog(): GameLogConfig {
  return fromCounts(
    [
      { key: "snaps", label: "SNAPS" },
      { key: "tkl", label: "TKL" },
      { key: "tfl", label: "TFL" },
      { key: "sack", label: "SACK", tone: "positive" },
      { key: "qbHit", label: "QB HIT" },
      { key: "press", label: "PRESS" },
      { key: "ff", label: "FF", tone: "positive" },
      { key: "pen", label: "PEN", tone: "negative" },
    ],
    (row) => ({
      snaps: num(row, "defense_snaps"),
      tkl: totalTackles(row),
      tfl: num(row, "def_tackles_for_loss"),
      sack: num(row, "def_sacks"),
      qbHit: num(row, "def_qb_hits"),
      press: num(row, "def_pressures"),
      ff: num(row, "def_fumbles_forced"),
      pen: num(row, "penalties"),
    }),
  )
}

// Corners and safeties keep separate percentile pools but log the same
// coverage box score.
function secondaryLog(): GameLogConfig {
  return fromCounts(
    [
      { key: "snaps", label: "SNAPS" },
      { key: "tkl", label: "TKL" },
      { key: "int", label: "INT", tone: "positive" },
      { key: "pd", label: "PD" },
      { key: "tgt", label: "TGT" },
      { key: "yardsAllowed", label: "YDS ALLOWED", tone: "negative" },
      { key: "tdAllowed", label: "TD ALLOWED", tone: "negative" },
      { key: "ratingAllowed", label: "RTG ALLOWED" },
    ],
    (row) => {
      const int = num(row, "def_interceptions")
      const tgt = num(row, "def_targets")
      const yardsAllowed = num(row, "def_yards_allowed")
      const tdAllowed = num(row, "def_receiving_td_allowed")
      return {
        snaps: num(row, "defense_snaps"),
        tkl: totalTackles(row),
        int,
        pd: num(row, "def_pass_defended"),
        tgt,
        yardsAllowed,
        tdAllowed,
        ratingAllowed: passerRating(num(row, "def_completions_allowed"), tgt, yardsAllowed, tdAllowed, int),
      }
    },
  )
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
  EDGE: defensiveLineLog(),
  DL: defensiveLineLog(),
  LB: fromCounts(
    [
      { key: "snaps", label: "SNAPS" },
      { key: "tkl", label: "TKL" },
      { key: "tfl", label: "TFL" },
      { key: "sack", label: "SACK" },
      { key: "pd", label: "PD" },
      { key: "int", label: "INT", tone: "positive" },
      { key: "ff", label: "FF", tone: "positive" },
      { key: "miss", label: "MISS", tone: "negative" },
    ],
    (row) => ({
      snaps: num(row, "defense_snaps"),
      tkl: totalTackles(row),
      tfl: num(row, "def_tackles_for_loss"),
      sack: num(row, "def_sacks"),
      pd: num(row, "def_pass_defended"),
      int: num(row, "def_interceptions"),
      ff: num(row, "def_fumbles_forced"),
      miss: num(row, "def_missed_tackles"),
    }),
  ),
  CB: secondaryLog(),
  S: secondaryLog(),
  OL: fromCounts(
    [
      { key: "snaps", label: "SNAPS" },
      { key: "snapPct", label: "SNAP %" },
      { key: "pen", label: "PEN", tone: "negative" },
      { key: "penYards", label: "PEN YDS", tone: "negative" },
    ],
    (row) => ({
      snaps: num(row, "offense_snaps"),
      snapPct: snapPct(row, "offense"),
      pen: num(row, "penalties"),
      penYards: num(row, "penalty_yards"),
    }),
  ),
  K: {
    ...fromCounts(
      [
        { key: "fgm", label: "FGM" },
        { key: "fga", label: "FGA" },
        { key: "fgPct", label: "FG%" },
        { key: "long", label: "LONG" },
        { key: "fg50", label: "50+", tone: "positive" },
        { key: "xpm", label: "XPM" },
        { key: "xpa", label: "XPA" },
      ],
      (row) => {
        const fgm = num(row, "fg_made")
        const fga = num(row, "fg_att")
        return {
          fgm,
          fga,
          fgPct: perAttempt(fgm * 100, fga),
          long: num(row, "fg_long"),
          fg50: num(row, "fg_made_50_59") + num(row, "fg_made_60_"),
          xpm: num(row, "pat_made"),
          xpa: num(row, "pat_att"),
        }
      },
    ),
    // Everything sums except the long, which is the season's longest.
    toTotals(rows) {
      const totals = GAME_LOG_CONFIGS.K.toStats(summedRow(rows))
      return {
        ...totals,
        long: Math.max(0, ...rows.map((row) => num(row, "fg_long"))),
      }
    },
  },
  P: fromCounts(
    [
      { key: "punts", label: "PUNTS" },
      { key: "avg", label: "AVG" },
      { key: "net", label: "NET" },
      { key: "in20", label: "IN20", tone: "positive" },
      { key: "tb", label: "TB" },
    ],
    (row) => {
      const punts = num(row, "pt_att")
      return {
        punts,
        avg: perAttempt(num(row, "pt_yards"), punts),
        net: perAttempt(num(row, "pt_net_yards"), punts),
        in20: num(row, "pt_inside_20"),
        tb: num(row, "pt_touchback"),
      }
    },
  ),
}

// Roster positions are finer-grained than the site's position groups (FB,
// OLB, SAF, ...) - bucket each into the group whose stats fit it best. Long
// snappers have no group.
const POSITION_BUCKET: Record<string, PositionGroup> = {
  QB: "QB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  DE: "DL",
  DT: "DL",
  NT: "DL",
  DL: "DL",
  LB: "LB",
  ILB: "LB",
  MLB: "LB",
  OLB: "LB",
  CB: "CB",
  S: "S",
  SS: "S",
  FS: "S",
  SAF: "S",
  DB: "CB",
  T: "OL",
  OT: "OL",
  G: "OL",
  OG: "OL",
  C: "OL",
  OL: "OL",
  K: "K",
  P: "P",
}

export function positionGroupFor(position: string | null): PositionGroup | null {
  return position === null ? null : (POSITION_BUCKET[position] ?? null)
}

export function gameLogConfigForPosition(position: string | null): GameLogConfig | null {
  const group = positionGroupFor(position)
  return group ? GAME_LOG_CONFIGS[group] : null
}

// Preferred over gameLogConfigForPosition wherever the server-supplied group
// is available: a 3-4 edge rusher is listed at position "OLB", which maps to
// the off-ball linebacker log and drops the pressure columns he's judged on.
export function gameLogConfigForGroup(group: string | null): GameLogConfig | null {
  return group && group in GAME_LOG_CONFIGS
    ? GAME_LOG_CONFIGS[group as PositionGroup]
    : null
}
