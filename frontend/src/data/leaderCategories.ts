// leaderCategories.ts
// Per-category Stat Leaders config: /players query, columns, and row-to-stats mapping.
import { passerRating, perAttempt, TACKLE_FIELDS, totalTackles } from "../lib/footballStats"
import type { LeaderColumn } from "./leaderStatsTypes"

// One row from /players, restricted via ?fields=... to whatever a category needs
// plus the identity fields every category asks for.
export type RawPlayerRow = Record<string, string | number | null> & {
  player_id: string
  player_display_name: string
  recent_team: string
  headshot_url: string | null
}

// The position groups the player-groups page toggles between. Extending this
// list means adding a matching LEADER_CATEGORIES entry - the toggle and Stat
// Leaders panel both read from this one list. K and P are split out of
// nflverse's combined "SPEC" group by the backend.
export const POSITION_GROUPS = ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "OL", "K", "P"] as const
export type PositionGroup = (typeof POSITION_GROUPS)[number]

// "QBs", "DBs", ... - except where the abbreviation doesn't pluralize readably.
const PLURALS: Partial<Record<PositionGroup, string>> = { K: "kickers", P: "punters" }

export function positionPlural(position: PositionGroup): string {
  return PLURALS[position] ?? `${position}s`
}

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

const IDENTITY_FIELDS = ["player_id", "player_display_name", "recent_team", "headshot_url"]

function playersPath(sort: string, fields: string[], positionGroup?: PositionGroup): string {
  const params = new URLSearchParams({ sort, limit: String(LEADER_POOL_SIZE), fields: fields.join(",") })
  if (positionGroup) params.set("position_group", positionGroup)
  return `/players?${params.toString()}`
}

// WR and TE leaders are the same shape (targets/receptions/yards/TDs/YPR) -
// only the position filter differs, so both categories share this factory
// rather than duplicating the column/toStats definitions.
function receivingCategory(position: "WR" | "TE"): LeaderCategoryConfig {
  return {
    key: `${position.toLowerCase()}-receiving`,
    position,
    label: "Receiving",
    path: playersPath(
      "-receiving_yards",
      [
        "player_id",
        "player_display_name",
        "recent_team",
        "headshot_url",
        "receptions",
        "targets",
        "receiving_yards",
        "receiving_tds",
        "fumbles_lost_total",
      ],
      position,
    ),
    columns: [
      { key: "rec", label: "REC" },
      { key: "tgt", label: "TGT" },
      { key: "yards", label: "YARDS" },
      { key: "td", label: "TD", tone: "positive" },
      { key: "ypr", label: "YPR" },
      { key: "fum", label: "FUM", tone: "negative" },
    ],
    defaultSortKey: "yards",
    toStats: (row) => {
      const rec = Number(row.receptions)
      const yards = Number(row.receiving_yards)
      return {
        rec,
        tgt: Number(row.targets),
        yards,
        td: Number(row.receiving_tds),
        ypr: perAttempt(yards, rec),
        fum: Number(row.fumbles_lost_total),
      }
    },
  }
}

export const LEADER_CATEGORIES: LeaderCategoryConfig[] = [
  {
    key: "passing",
    position: "QB",
    label: "Passing",
    path: playersPath(
      "-passing_yards",
      [
        "player_id",
        "player_display_name",
        "recent_team",
        "headshot_url",
        "completions",
        "attempts",
        "passing_yards",
        "passing_tds",
        "passing_interceptions",
        "fumbles_lost_total",
      ],
      "QB",
    ),
    columns: [
      { key: "cmp", label: "CMP" },
      { key: "att", label: "ATT" },
      { key: "cmpPct", label: "CMP%" },
      { key: "yards", label: "YARDS" },
      { key: "td", label: "TD", tone: "positive" },
      { key: "int", label: "INT", tone: "negative" },
      { key: "fum", label: "FUM", tone: "negative" },
      { key: "rating", label: "RATING" },
    ],
    defaultSortKey: "yards",
    toStats: (row) => {
      const cmp = Number(row.completions)
      const att = Number(row.attempts)
      const yards = Number(row.passing_yards)
      const td = Number(row.passing_tds)
      const int = Number(row.passing_interceptions)
      return {
        cmp,
        att,
        cmpPct: perAttempt(cmp * 100, att),
        yards,
        td,
        int,
        fum: Number(row.fumbles_lost_total),
        rating: passerRating(cmp, att, yards, td, int),
      }
    },
  },
  receivingCategory("WR"),
  receivingCategory("TE"),
  {
    key: "rushing",
    position: "RB",
    label: "Rushing",
    // Includes receiving stats — pass-catching volume is a big part of an RB's fantasy value.
    path: playersPath(
      "-rushing_yards",
      [
        "player_id",
        "player_display_name",
        "recent_team",
        "headshot_url",
        "carries",
        "rushing_yards",
        "rushing_tds",
        "receptions",
        "receiving_yards",
        "receiving_tds",
        "fumbles_lost_total",
      ],
      "RB",
    ),
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
        fum: Number(row.fumbles_lost_total),
      }
    },
  },
  {
    key: "pass-rush",
    position: "DL",
    label: "Pass Rush",
    path: playersPath(
      "-def_sacks",
      [
        ...IDENTITY_FIELDS,
        ...TACKLE_FIELDS,
        "def_tackles_for_loss",
        "def_sacks",
        "def_qb_hits",
        "def_pressures",
        "def_fumbles_forced",
        "penalties",
      ],
      "DL",
    ),
    columns: [
      { key: "tkl", label: "TKL" },
      { key: "tfl", label: "TFL" },
      { key: "sack", label: "SACK", tone: "positive" },
      { key: "qbHit", label: "QB HIT" },
      { key: "press", label: "PRESS" },
      { key: "ff", label: "FF", tone: "positive" },
      { key: "pen", label: "PEN", tone: "negative" },
    ],
    defaultSortKey: "sack",
    toStats: (row) => ({
      tkl: totalTackles(row),
      tfl: Number(row.def_tackles_for_loss),
      sack: Number(row.def_sacks),
      qbHit: Number(row.def_qb_hits),
      press: Number(row.def_pressures),
      ff: Number(row.def_fumbles_forced),
      pen: Number(row.penalties),
    }),
  },
  {
    key: "tackling",
    position: "LB",
    label: "Tackling",
    // Server-side sort can only use one column, so the pool is fetched by
    // solo tackles - the top 5 by total tackles are always well inside it.
    path: playersPath(
      "-def_tackles_solo",
      [
        ...IDENTITY_FIELDS,
        ...TACKLE_FIELDS,
        "def_tackles_for_loss",
        "def_sacks",
        "def_pass_defended",
        "def_interceptions",
        "def_fumbles_forced",
        "def_missed_tackles",
      ],
      "LB",
    ),
    columns: [
      { key: "tkl", label: "TKL" },
      { key: "tfl", label: "TFL" },
      { key: "sack", label: "SACK" },
      { key: "pd", label: "PD" },
      { key: "int", label: "INT", tone: "positive" },
      { key: "ff", label: "FF", tone: "positive" },
      { key: "miss", label: "MISS", tone: "negative" },
    ],
    defaultSortKey: "tkl",
    toStats: (row) => ({
      tkl: totalTackles(row),
      tfl: Number(row.def_tackles_for_loss),
      sack: Number(row.def_sacks),
      pd: Number(row.def_pass_defended),
      int: Number(row.def_interceptions),
      ff: Number(row.def_fumbles_forced),
      miss: Number(row.def_missed_tackles),
    }),
  },
  {
    key: "coverage",
    position: "DB",
    label: "Coverage",
    path: playersPath(
      "-def_pass_defended",
      [
        ...IDENTITY_FIELDS,
        ...TACKLE_FIELDS,
        "def_interceptions",
        "def_pass_defended",
        "def_targets",
        "def_completions_allowed",
        "def_yards_allowed",
        "def_receiving_td_allowed",
      ],
      "DB",
    ),
    columns: [
      { key: "tkl", label: "TKL" },
      { key: "int", label: "INT", tone: "positive" },
      { key: "pd", label: "PD" },
      { key: "tgt", label: "TGT" },
      { key: "yardsAllowed", label: "YDS ALLOWED", tone: "negative" },
      { key: "tdAllowed", label: "TD ALLOWED", tone: "negative" },
      { key: "ratingAllowed", label: "RTG ALLOWED" },
    ],
    defaultSortKey: "pd",
    toStats: (row) => {
      const int = Number(row.def_interceptions)
      const tgt = Number(row.def_targets)
      const yardsAllowed = Number(row.def_yards_allowed)
      const tdAllowed = Number(row.def_receiving_td_allowed)
      return {
        tkl: totalTackles(row),
        int,
        pd: Number(row.def_pass_defended),
        tgt,
        yardsAllowed,
        tdAllowed,
        ratingAllowed: passerRating(Number(row.def_completions_allowed), tgt, yardsAllowed, tdAllowed, int),
      }
    },
  },
  {
    key: "offensive-line",
    position: "OL",
    label: "Offensive Line",
    // Penalties are the only per-lineman stat nflverse tracks - no blocking grades.
    path: playersPath(
      "-offense_snaps",
      [...IDENTITY_FIELDS, "offense_snaps", "offense_snap_pct", "penalties", "penalty_yards"],
      "OL",
    ),
    columns: [
      { key: "snaps", label: "SNAPS" },
      { key: "snapPct", label: "SNAP %" },
      { key: "pen", label: "PEN", tone: "negative" },
      { key: "penYards", label: "PEN YDS", tone: "negative" },
    ],
    defaultSortKey: "snaps",
    toStats: (row) => ({
      snaps: Number(row.offense_snaps),
      snapPct: Math.round(Number(row.offense_snap_pct) * 10) / 10,
      pen: Number(row.penalties),
      penYards: Number(row.penalty_yards),
    }),
  },
  {
    key: "kicking",
    position: "K",
    label: "Kicking",
    path: playersPath(
      "-fg_made",
      [...IDENTITY_FIELDS, "fg_made", "fg_att", "fg_long", "fg_made_50_59", "fg_made_60_", "pat_made", "pat_att"],
      "K",
    ),
    columns: [
      { key: "fgm", label: "FGM" },
      { key: "fga", label: "FGA" },
      { key: "fgPct", label: "FG%" },
      { key: "long", label: "LONG" },
      { key: "fg50", label: "50+", tone: "positive" },
      { key: "xpm", label: "XPM" },
      { key: "xpa", label: "XPA" },
    ],
    defaultSortKey: "fgm",
    toStats: (row) => {
      const fgm = Number(row.fg_made)
      const fga = Number(row.fg_att)
      return {
        fgm,
        fga,
        fgPct: perAttempt(fgm * 100, fga),
        long: Number(row.fg_long),
        fg50: Number(row.fg_made_50_59) + Number(row.fg_made_60_),
        xpm: Number(row.pat_made),
        xpa: Number(row.pat_att),
      }
    },
  },
  {
    key: "punting",
    position: "P",
    label: "Punting",
    path: playersPath(
      "-pt_att",
      [...IDENTITY_FIELDS, "pt_att", "pt_yards", "pt_net_yards", "pt_inside_20", "pt_touchback"],
      "P",
    ),
    columns: [
      { key: "punts", label: "PUNTS" },
      { key: "avg", label: "AVG" },
      { key: "net", label: "NET" },
      { key: "in20", label: "IN20", tone: "positive" },
      { key: "tb", label: "TB" },
    ],
    defaultSortKey: "punts",
    toStats: (row) => {
      const punts = Number(row.pt_att)
      return {
        punts,
        avg: perAttempt(Number(row.pt_yards), punts),
        net: perAttempt(Number(row.pt_net_yards), punts),
        in20: Number(row.pt_inside_20),
        tb: Number(row.pt_touchback),
      }
    },
  },
]
