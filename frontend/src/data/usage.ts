// usage.ts
// The usage payload's shape and its colour assignment, shared by the player
// page's focused charts and the team page's unfocused ones.

export interface UsagePlayerAmount {
  player_id: string | null
  name: string
  headshot_url: string | null
  value: number
}

export interface Teammate {
  player_id: string
  name: string
  value: number
}

export interface WeeklyPoint {
  week: number
  team_value: number
  players: UsagePlayerAmount[]
}

export interface UsageShare {
  // null on the team view, which ranks the whole pool with nobody singled out.
  player_id: string | null
  team: string
  metric: string
  label: string
  player_value: number
  team_value: number
  teammates: Teammate[]
  weekly: WeeklyPoint[]
}

export const OTHER_KEY = "__other__"

// A validated categorical palette (see the dataviz skill's palette.md) -
// fixed hue order, cycled for pools deeper than 8 players (a tackle-share
// pool can run 30+). The focus player uses their own team color instead, so
// this only needs to cover teammates.
const CATEGORICAL_PALETTE = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
]

// One color per player, shared by the donut and the weekly lines so a given
// teammate is always the same color in both - one fixed palette, assigned
// by rank in a single combined list (this player included, not a special
// case), ordered by season total descending. No team colors: the point is
// a consistent, position-based color per rank, the same across every
// player's page, not a color tied to which team happens to be selected.
// QB TD involvement is the exception, and takes the team's two colors
// instead: it's a this-QB-vs-the-rest-of-his-team split rather than a
// roster of individually ranked players, so a rank-based palette would be
// encoding a ranking that isn't there.
export function buildColorByKey(
  usage: UsageShare,
  playerId: string | null,
  teamColor: string,
  teamColor2: string,
): Map<string, string> {
  if (usage.metric === "td_involvement" && playerId) {
    return new Map([
      [playerId, teamColor],
      [OTHER_KEY, teamColor2],
    ])
  }
  // Everyone is ranked together and takes a palette color in that order, the
  // focus player included - he's told apart by opacity, not by hue, so his
  // slice and his line stay the same color.
  //
  // Ties break on player_id, never on value alone: a value-only sort would
  // float the focus player above the group he's tied with and shift that
  // group's colors, so a teammate would change color just because a different
  // player's page is open.
  const ranked = [
    ...(playerId ? [{ id: playerId, value: usage.player_value }] : []),
    ...usage.teammates.map((teammate) => ({ id: teammate.player_id, value: teammate.value })),
  ].sort((a, b) => b.value - a.value || a.id.localeCompare(b.id))
  return new Map(
    ranked.map((entry, index) => [entry.id, CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length]]),
  )
}
