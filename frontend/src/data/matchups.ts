// matchups.ts
// Types for /matchups/{game_id} plus the shaping a matchup view needs: the
// cross-pairing of one team's offense against the other's defense, the spread
// defense, and drive results grouped per team.
export interface UnitRate {
  plays: number
  epa: number | null
  epa_per_play: number | null
  success_rate: number | null
}

export interface Unit {
  plays: number
  overall: UnitRate
  pass: UnitRate
  run: UnitRate
}

export interface MatchupTeam {
  team: string
  offense: Unit
  defense: Unit
}

export interface GameTeam extends MatchupTeam {
  plays: number
  yards: number
  pass_yards: number
  pass_plays: number
  rush_yards: number
  rush_plays: number
  first_downs: number
  interceptions: number
  fumbles_lost: number
  turnovers: number
  sacks: number
  // Pressures come from PFR, which posts later than the play-by-play, so a
  // just-finished game has none yet.
  pressures: number | null
  penalties: number
  penalty_yards: number
  time_of_possession: number
  third_down_attempts: number
  third_down_conversions: number
}

export interface Leader {
  team: string
  player_id: string | null
  name: string | null
  position: string | null
  headshot_url: string | null
  value: number
}

export interface LeaderRow {
  key: string
  label: string
  leaders: (Leader | null)[]
}

export interface BoxPlayer {
  player_id: string | null
  name: string | null
  position: string | null
  pressures?: number | null
  [stat: string]: string | number | null | undefined
}

export interface BoxTeam {
  team: string
  passing: BoxPlayer[]
  rushing: BoxPlayer[]
  receiving: BoxPlayer[]
  defense: BoxPlayer[]
}

export interface Drive {
  drive: number
  team: string
  quarter: number
  result: string | null
  plays: number
  yards: number
}

export interface QuarterScore {
  quarter: number
  away: number
  home: number
}

/** "Q1".."Q4", then OT once past regulation (quarter 5 and up). */
export function quarterLabel(quarter: number): string {
  return quarter > 4 ? (quarter === 5 ? "OT" : `OT${quarter - 4}`) : `Q${quarter}`
}

export interface WinProbabilityPoint {
  elapsed: number
  quarter: number
  home_wp: number
}

export interface MatchupGame {
  game_id: string
  season: number
  game_type: string
  week: number
  gameday: string
  weekday: string
  gametime: string
  away_team: string
  home_team: string
  away_score: number | null
  home_score: number | null
  div_game: number | null
}

export interface RecentGame {
  game_id: string
  week: number
  opponent: string
  home: boolean
  points_for: number
  points_against: number
  result: "W" | "L" | "T"
}

export interface PreviewTeam extends GameTeam {
  // Games played so far, which every counting stat here is averaged over.
  games: number
  // Newest first.
  form: RecentGame[]
}

export interface Matchup {
  status: "final" | "scheduled"
  game: MatchupGame
  preview?: { teams: PreviewTeam[]; leaders: LeaderRow[] }
  breakdown?: {
    teams: GameTeam[]
    line_score: QuarterScore[]
    drives: Drive[]
    win_probability: WinProbabilityPoint[]
    leaders: LeaderRow[]
    box_score: BoxTeam[]
  }
}

export type Phase = "pass" | "run" | "overall"

export interface Edge {
  phase: Phase
  label: string
  offense: { team: string; rate: UnitRate }
  defense: { team: string; rate: UnitRate }
}

/** A matchup is one team's offense against the other's defense, so each side
 * of the ball gets its own pair. Returns the pairs with `attacking` on
 * offense, pass and run apart because that's where a mismatch shows.
 */
export function edgesFor(attacking: MatchupTeam, defending: MatchupTeam): Edge[] {
  const phases: [Phase, string][] = [
    ["overall", "Overall"],
    ["pass", "Pass"],
    ["run", "Run"],
  ]
  return phases.map(([phase, label]) => ({
    phase,
    label,
    offense: { team: attacking.team, rate: attacking.offense[phase] },
    defense: { team: defending.team, rate: defending.defense[phase] },
  }))
}

export function teamOf(matchup: Matchup, side: "away" | "home"): string {
  return side === "away" ? matchup.game.away_team : matchup.game.home_team
}

// Drive results read from the offense's side. "Opp touchdown" and "Safety"
// are the other team scoring on this drive, so neither counts as putting
// points up - a pick six is the worst outcome a drive has, not a green one.
const SCORING = new Set(["Touchdown", "Field goal"])
const TURNOVERS = new Set(["Turnover", "Turnover on downs", "Opp touchdown"])

export function driveScored(drive: Drive): boolean {
  return drive.result !== null && SCORING.has(drive.result)
}

export function driveTurnover(drive: Drive): boolean {
  return drive.result !== null && TURNOVERS.has(drive.result)
}

/** Each team's drives in game order, so the two can be shown as parallel
 * timelines rather than one interleaved list.
 */
export function drivesByTeam(drives: Drive[], teams: string[]): Record<string, Drive[]> {
  const byTeam: Record<string, Drive[]> = {}
  for (const team of teams) byTeam[team] = []
  for (const drive of drives) byTeam[drive.team]?.push(drive)
  return byTeam
}

export function formatEpa(value: number | null): string {
  if (value === null) return "—"
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`
}

/** EPA per play sits roughly within ±0.5, so that's the scale a bar is drawn
 * against; anything beyond it pins to the end rather than rescaling the rest.
 */
export const EPA_SCALE = 0.5

export function epaWidth(value: number | null): number {
  if (value === null) return 0
  return Math.min(Math.abs(value) / EPA_SCALE, 1) * 100
}

// A comparison row is drawn one of two ways. A `share` metric is additive -
// the two teams' values sum to something meaningful, so a 100% split bar
// reads as "who had more of it". A `scale` metric is a rate or an EPA, where
// a split would be meaningless (and impossible below zero), so both are drawn
// against a common scale instead.
export type RowKind = "share" | "scale"

export interface ComparisonRow {
  key: string
  label: string
  group: string
  kind: RowKind
  // In the short view before the panel is expanded.
  gist: boolean
  value: (team: GameTeam) => number | null
  format: (value: number | null) => string
  // Scale rows only: the value that would take none of the bar. EPA is the
  // reason this exists - it goes negative, and a team at -0.2 has done worse
  // than one at -0.1, so the split has to be measured from below zero.
  floor?: number
  lowerIsBetter?: boolean
}

function per(total: number, plays: number): number | null {
  return plays > 0 ? Math.round((total / plays) * 100) / 100 : null
}

export function formatClock(seconds: number | null): string {
  if (seconds === null) return "—"
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

const whole = (value: number | null) => (value === null ? "—" : String(Math.round(value)))
const decimal = (value: number | null) => (value === null ? "—" : value.toFixed(1))

// A team's EPA per play sits well inside this either way, so it's the point
// at which a bar runs out rather than a value anyone actually posts.
export const EPA_FLOOR = -0.8

// A unit's total EPA for a game sits well inside this either way.
export const EPA_TOTAL_FLOOR = -25

export const COMPARISON_ROWS: ComparisonRow[] = [
  { key: "plays", label: "Plays", group: "Overall", kind: "share", gist: true,
    value: (t) => t.plays, format: whole },
  { key: "yards", label: "Yards", group: "Overall", kind: "share", gist: true,
    value: (t) => t.yards, format: whole },
  { key: "yards_per_play", label: "Yards / Play", group: "Overall", kind: "scale", gist: true,
    value: (t) => per(t.yards, t.plays), format: decimal },
  { key: "success_rate", label: "Success Rate", group: "Overall", kind: "scale", gist: true,
    value: (t) => t.offense.overall.success_rate,
    format: (v) => (v === null ? "—" : `${v}%`) },

  { key: "pass_yards", label: "Pass Yards", group: "Passing", kind: "share", gist: true,
    value: (t) => t.pass_yards, format: whole },
  { key: "pass_yards_per_play", label: "Yards / Dropback", group: "Passing", kind: "scale",
    gist: true, value: (t) => per(t.pass_yards, t.pass_plays), format: decimal },
  { key: "pass_epa", label: "Pass EPA / Play", group: "Passing", kind: "scale", gist: true,
    value: (t) => t.offense.pass.epa_per_play, format: formatEpa, floor: EPA_FLOOR },
  { key: "pass_epa_total", label: "Total Pass EPA", group: "Passing", kind: "scale", gist: false,
    value: (t) => t.offense.pass.epa, format: formatEpa, floor: EPA_TOTAL_FLOOR },

  { key: "rush_yards", label: "Rush Yards", group: "Rushing", kind: "share", gist: true,
    value: (t) => t.rush_yards, format: whole },
  { key: "rush_yards_per_play", label: "Yards / Carry", group: "Rushing", kind: "scale",
    gist: true, value: (t) => per(t.rush_yards, t.rush_plays), format: decimal },
  { key: "rush_epa", label: "Rush EPA / Play", group: "Rushing", kind: "scale", gist: true,
    value: (t) => t.offense.run.epa_per_play, format: formatEpa, floor: EPA_FLOOR },
  { key: "rush_epa_total", label: "Total Rush EPA", group: "Rushing", kind: "scale", gist: false,
    value: (t) => t.offense.run.epa, format: formatEpa, floor: EPA_TOTAL_FLOOR },

  { key: "first_downs", label: "First Downs", group: "Drives", kind: "share", gist: true,
    value: (t) => t.first_downs, format: whole },
  { key: "third_downs", label: "Third Downs", group: "Drives", kind: "share", gist: true,
    value: (t) => t.third_down_conversions, format: whole },
  { key: "time_of_possession", label: "Time of Possession", group: "Drives", kind: "share",
    gist: true, value: (t) => t.time_of_possession, format: formatClock },

  { key: "sacks", label: "Sacks", group: "Defense", kind: "share", gist: false,
    value: (t) => t.sacks, format: whole },
  { key: "pressures", label: "Pressures", group: "Defense", kind: "share", gist: false,
    value: (t) => t.pressures, format: whole },

  { key: "turnovers", label: "Turnovers", group: "Discipline", kind: "share", gist: true,
    value: (t) => t.turnovers, format: whole, lowerIsBetter: true },
  { key: "interceptions", label: "Interceptions", group: "Discipline", kind: "share", gist: false,
    value: (t) => t.interceptions, format: whole, lowerIsBetter: true },
  { key: "fumbles_lost", label: "Fumbles Lost", group: "Discipline", kind: "share", gist: false,
    value: (t) => t.fumbles_lost, format: whole, lowerIsBetter: true },
  { key: "penalties", label: "Penalties", group: "Discipline", kind: "share", gist: false,
    value: (t) => t.penalties, format: whole, lowerIsBetter: true },
  { key: "penalty_yards", label: "Penalty Yards", group: "Discipline", kind: "share", gist: false,
    value: (t) => t.penalty_yards, format: whole, lowerIsBetter: true },
]

// The short view's own order. It isn't grouped, so it doesn't have to follow
// the groups: volume, then efficiency, then each phase, then how the drives
// ended.
const GIST_ORDER = [
  "plays",
  "yards",
  "yards_per_play",
  "success_rate",
  "pass_yards",
  "pass_yards_per_play",
  "pass_epa",
  "rush_yards",
  "rush_yards_per_play",
  "rush_epa",
  "first_downs",
  "third_downs",
  "turnovers",
  "time_of_possession",
]

export function gistRows(): ComparisonRow[] {
  const byKey = new Map(COMPARISON_ROWS.map((row) => [row.key, row]))
  return GIST_ORDER.map((key) => byKey.get(key)).filter(
    (row): row is ComparisonRow => row !== undefined,
  )
}

/** Third downs read as a fraction, not a bare count. */
export function thirdDowns(team: GameTeam): string {
  return `${team.third_down_conversions}/${team.third_down_attempts}`
}

/** The share of a split bar one side takes, measured from `floor`. The two
 * shares always sum to 100, so the bar spans the full track whatever the
 * numbers are; both at the floor splits it evenly rather than collapsing.
 */
export function shareOf(a: number | null, b: number | null, floor = 0): number {
  const left = Math.max((a ?? floor) - floor, 0)
  const right = Math.max((b ?? floor) - floor, 0)
  const total = left + right
  return total === 0 ? 50 : (left / total) * 100
}


export interface SankeyNode {
  name: string
  // The team whose colour this node takes, or null for an outcome node.
  team: string | null
  scored: boolean
  turnover: boolean
}

export interface SankeyLink {
  source: number
  target: number
  value: number
}

/** Drives as flows from each team to how its drives ended: a node per team,
 * a node per outcome that happened, and a link weighted by how many drives
 * ended that way. Outcomes are ordered scoring first, so the top of the
 * chart is points and the bottom is everything else.
 */
export function drivesToSankey(
  drives: Drive[],
  teams: string[],
): { nodes: SankeyNode[]; links: SankeyLink[] } {
  const counts = new Map<string, Map<string, number>>()
  for (const drive of drives) {
    if (!teams.includes(drive.team)) continue
    const result = drive.result ?? "Unknown"
    const byResult = counts.get(drive.team) ?? new Map<string, number>()
    byResult.set(result, (byResult.get(result) ?? 0) + 1)
    counts.set(drive.team, byResult)
  }

  const outcomes = [...new Set(drives.map((drive) => drive.result ?? "Unknown"))].sort((a, b) => {
    const scoring = Number(SCORING.has(b)) - Number(SCORING.has(a))
    return scoring || a.localeCompare(b)
  })

  const nodes: SankeyNode[] = [
    ...teams.map((team) => ({ name: team, team, scored: false, turnover: false })),
    ...outcomes.map((name) => ({
      name,
      team: null,
      scored: SCORING.has(name),
      turnover: TURNOVERS.has(name),
    })),
  ]
  const links: SankeyLink[] = []
  teams.forEach((team, index) => {
    for (const [result, value] of counts.get(team) ?? []) {
      links.push({ source: index, target: teams.length + outcomes.indexOf(result), value })
    }
  })
  return { nodes, links }
}
