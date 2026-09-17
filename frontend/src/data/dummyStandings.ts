export interface TeamRecord {
  team: string
  wins: number
  losses: number
  ties: number
}

export interface DivisionStanding {
  name: string
  teams: TeamRecord[]
}

export function winPct({ wins, losses, ties }: TeamRecord): number {
  const games = wins + losses + ties
  return games === 0 ? 0 : (wins + ties * 0.5) / games
}

export function formatPct(record: TeamRecord): string {
  const formatted = winPct(record).toFixed(3)
  return formatted.startsWith("0.") ? formatted.slice(1) : formatted
}

// Placeholder data. Fictional records — to be replaced by live data from the backend.
export const DUMMY_STANDINGS: DivisionStanding[] = [
  {
    name: "AFC East",
    teams: [
      { team: "Buffalo Bills", wins: 11, losses: 6, ties: 0 },
      { team: "Miami Dolphins", wins: 11, losses: 6, ties: 0 },
      { team: "New York Jets", wins: 7, losses: 10, ties: 0 },
      { team: "New England Patriots", wins: 4, losses: 13, ties: 0 },
    ],
  },
  {
    name: "AFC North",
    teams: [
      { team: "Baltimore Ravens", wins: 13, losses: 4, ties: 0 },
      { team: "Cleveland Browns", wins: 11, losses: 6, ties: 0 },
      { team: "Pittsburgh Steelers", wins: 10, losses: 7, ties: 0 },
      { team: "Cincinnati Bengals", wins: 9, losses: 8, ties: 0 },
    ],
  },
  {
    name: "AFC South",
    teams: [
      { team: "Houston Texans", wins: 10, losses: 7, ties: 0 },
      { team: "Indianapolis Colts", wins: 9, losses: 8, ties: 0 },
      { team: "Jacksonville Jaguars", wins: 8, losses: 9, ties: 0 },
      { team: "Tennessee Titans", wins: 5, losses: 12, ties: 0 },
    ],
  },
  {
    name: "AFC West",
    teams: [
      { team: "Kansas City Chiefs", wins: 12, losses: 5, ties: 0 },
      { team: "Denver Broncos", wins: 10, losses: 7, ties: 0 },
      { team: "Los Angeles Chargers", wins: 9, losses: 8, ties: 0 },
      { team: "Las Vegas Raiders", wins: 6, losses: 11, ties: 0 },
    ],
  },
  {
    name: "NFC East",
    teams: [
      { team: "Philadelphia Eagles", wins: 13, losses: 4, ties: 0 },
      { team: "Dallas Cowboys", wins: 11, losses: 6, ties: 0 },
      { team: "Washington Commanders", wins: 8, losses: 9, ties: 0 },
      { team: "New York Giants", wins: 5, losses: 12, ties: 0 },
    ],
  },
  {
    name: "NFC North",
    teams: [
      { team: "Detroit Lions", wins: 14, losses: 3, ties: 0 },
      { team: "Green Bay Packers", wins: 10, losses: 7, ties: 0 },
      { team: "Chicago Bears", wins: 8, losses: 9, ties: 0 },
      { team: "Minnesota Vikings", wins: 7, losses: 10, ties: 0 },
    ],
  },
  {
    name: "NFC South",
    teams: [
      { team: "Tampa Bay Buccaneers", wins: 9, losses: 8, ties: 0 },
      { team: "Atlanta Falcons", wins: 8, losses: 9, ties: 0 },
      { team: "New Orleans Saints", wins: 7, losses: 10, ties: 0 },
      { team: "Carolina Panthers", wins: 4, losses: 13, ties: 0 },
    ],
  },
  {
    name: "NFC West",
    teams: [
      { team: "San Francisco 49ers", wins: 12, losses: 5, ties: 0 },
      { team: "Seattle Seahawks", wins: 9, losses: 8, ties: 0 },
      { team: "Los Angeles Rams", wins: 8, losses: 9, ties: 0 },
      { team: "Arizona Cardinals", wins: 5, losses: 12, ties: 0 },
    ],
  },
]
