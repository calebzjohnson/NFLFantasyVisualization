// depthChart.ts
// Shapes /teams/{team}/depth-chart into one table per unit: a row per position
// slot, players across in depth order.

export type DepthStatus =
  | "IR"
  | "PUP"
  | "SUSPENDED"
  | "EXEMPT"
  | "OUT"
  | "DOUBTFUL"
  | "QUESTIONABLE"

export interface DepthChartPlayer {
  player_id: string | null
  name: string | null
  rank: number
  status: DepthStatus | null
  injury: string | null
}

export interface DepthChartSlot {
  slot: number
  position: string
  position_name: string
  players: DepthChartPlayer[]
}

export interface DepthChartGroup {
  key: string
  label: string
  slots: DepthChartSlot[]
}

export interface DepthChartReportRow {
  player_id: string | null
  name: string | null
  position: string | null
  status: DepthStatus
  injury: string | null
  // The week the injury was last reported, which for a reserve player can be
  // several weeks back. nflverse's injury data carries no date, only a week.
  injury_week: number | null
  practice_status: string | null
}

export interface DepthChartResponse {
  team: string
  scheme: string | null
  groups: DepthChartGroup[]
  report: DepthChartReportRow[]
}

// Short badge text, then the full wording for the title and screen readers.
export const STATUS_LABEL: Record<DepthStatus, string> = {
  IR: "IR",
  PUP: "PUP",
  SUSPENDED: "SUS",
  EXEMPT: "EXE",
  OUT: "OUT",
  DOUBTFUL: "D",
  QUESTIONABLE: "Q",
}

export const STATUS_NAME: Record<DepthStatus, string> = {
  IR: "Injury Reserve",
  PUP: "Physically Unable to Perform",
  SUSPENDED: "Suspended",
  EXEMPT: "Commissioner Exempt List",
  OUT: "Out",
  DOUBTFUL: "Doubtful",
  QUESTIONABLE: "Questionable",
}

export const STATUS_TONE: Record<DepthStatus, string> = {
  IR: "text-[var(--negative)]",
  PUP: "text-[var(--negative)]",
  SUSPENDED: "text-[var(--text-secondary)]",
  EXEMPT: "text-[var(--text-secondary)]",
  OUT: "text-[var(--negative)]",
  DOUBTFUL: "text-[var(--warning)]",
  QUESTIONABLE: "text-[var(--warning)]",
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"]

export function depthLabel(index: number): string {
  return ORDINALS[index] ?? `${index + 1}th`
}

/** One header per depth column, as deep as the group's deepest slot. The API's
 * `rank` counts across same-named slots (the three WR spots run 1/4/7, 2/5/8,
 * 3/6/9), so a column is a player's place within his own slot, not his rank.
 */
export function depthColumns(group: DepthChartGroup): string[] {
  const deepest = group.slots.reduce((most, slot) => Math.max(most, slot.players.length), 0)
  return Array.from({ length: deepest }, (_, index) => depthLabel(index))
}
