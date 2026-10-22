// teamColors.ts
// Picks a pair of colours for a head-to-head chart. Team colours are chosen
// for helmets, not for sitting beside each other: BAL and MIN are both deep
// purple, HOU and DAL both navy. So the pair is measured for separation and
// swapped for the team's secondary colour, or dropped to the validated
// categorical pair, rather than shipping two bars nobody can tell apart.
import type { TeamInfo } from "./teams"

// The categorical palette's first two steps, validated for colourblind
// separation against this surface.
const FALLBACK: [string, string] = ["#2a78d6", "#eb6834"]

// OKLab deltaE x100. The validated floor for normal vision is 15; team
// colours are decorative here (the value and the team name both appear
// beside the bar), so this only has to clear "these are two colours".
const MIN_SEPARATION = 22

function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function oklab(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = parseInt(match[1], 16)
  const r = srgbToLinear((value >> 16) & 255)
  const g = srgbToLinear((value >> 8) & 255)
  const b = srgbToLinear(value & 255)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** OKLab distance x100 between two hex colours, or 0 if either won't parse. */
export function separation(a: string, b: string): number {
  const first = oklab(a)
  const second = oklab(b)
  if (!first || !second) return 0
  const dl = first[0] - second[0]
  const da = first[1] - second[1]
  const db = first[2] - second[2]
  return Math.sqrt(dl * dl + da * da + db * db) * 100
}

function colorsOf(teams: TeamInfo[], abbr: string): [string, string] | null {
  const team = teams.find((candidate) => candidate.team_abbr === abbr)
  return team ? [team.team_color, team.team_color2] : null
}

/** Two colours for these teams that are far enough apart to read as
 * different: their primaries where that holds, otherwise the second team's
 * alternate, otherwise the validated categorical pair.
 */
export function contrastingPair(
  teams: TeamInfo[],
  away: string,
  home: string,
): [string, string] {
  const first = colorsOf(teams, away)
  const second = colorsOf(teams, home)
  if (!first || !second) return FALLBACK

  // Both primaries where they separate; otherwise the home team shifts to
  // its alternate, so the visitor is the one that keeps its own colour.
  for (const pair of [
    [first[0], second[0]],
    [first[0], second[1]],
    [first[1], second[0]],
  ] as [string, string][]) {
    if (separation(pair[0], pair[1]) >= MIN_SEPARATION) return pair
  }
  return FALLBACK
}
