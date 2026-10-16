// tendencies.ts
// Shapes /teams/{team}/tendencies into bars. Every bar is a 100% split in two
// parts: most rates arrive as complementary pairs, and the rest get their
// complement derived, so no bar is a lone stub.
export interface Tendency {
  key: string
  label: string
  group: string
  value: number
  rank: number
  teams: number
  league_average: number
}

export interface Segment {
  label: string
  value: number
  rank: number
  leagueAverage: number
}

export interface TendencyBar {
  key: string
  group: string
  // Names the split. The segment labels alone can't: a conversion's read
  // "Converted / Failed", which doesn't say which down.
  title: string
  teams: number
  segments: [Segment, Segment]
}

// Floating-point sums land a hair off 100.
const SUM_TOLERANCE = 0.2

// Conversions are a rate against attempts rather than one half of a pair, so
// the backend sends no opposite for them and it's derived here.
const CONVERSION = /_conversion$/

function segment(tendency: Tendency, label = shortLabel(tendency.label)): Segment {
  return {
    label,
    value: tendency.value,
    rank: tendency.rank,
    leagueAverage: tendency.league_average,
  }
}

function complementOf(tendency: Tendency): Segment {
  return {
    label: CONVERSION.test(tendency.key) ? "Failed" : "Other",
    value: Math.round((100 - tendency.value) * 10) / 10,
    // The complement's order is the exact reverse: most converted is least
    // failed.
    rank: tendency.teams + 1 - tendency.rank,
    leagueAverage: Math.round((100 - tendency.league_average) * 10) / 10,
  }
}

function complementary(a: Tendency, b: Tendency): boolean {
  return Math.abs(a.value + b.value - 100) <= SUM_TOLERANCE
}

export function toBars(tendencies: Tendency[]): TendencyBar[] {
  const bars: TendencyBar[] = []
  for (let i = 0; i < tendencies.length; i++) {
    const a = tendencies[i]
    const b = tendencies[i + 1]
    const paired = b && b.group === a.group && complementary(a, b)
    bars.push({
      key: a.key,
      group: a.group,
      title: paired ? `${shortLabel(a.label)} / ${shortLabel(b.label)}` : shortLabel(a.label),
      teams: a.teams,
      segments: [
        segment(a, !paired && CONVERSION.test(a.key) ? "Converted" : shortLabel(a.label)),
        paired ? segment(b) : complementOf(a),
      ],
    })
    if (paired) i++
  }
  return bars
}

/** "Dropback Rate" -> "Dropback": the bar's own labels carry the rest. */
export function shortLabel(label: string): string {
  return label.replace(/ (Rate|Conversion)$/, "")
}
