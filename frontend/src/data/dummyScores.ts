export interface TeamScore {
  team: string
  score: number
}

export interface GameScore {
  id: string
  week: string
  kickoff: string
  status: string
  away: TeamScore
  home: TeamScore
}

// Placeholder data. Fictional results — to be replaced by live data from the backend.
export const DUMMY_SCORES: GameScore[] = [
  { id: "1", week: "Week 18", kickoff: "Thu 8:15 PM", status: "Final", away: { team: "New Orleans Saints", score: 27 }, home: { team: "Tampa Bay Buccaneers", score: 24 } },
  { id: "2", week: "Week 18", kickoff: "Sat 1:00 PM", status: "Final", away: { team: "Minnesota Vikings", score: 20 }, home: { team: "Detroit Lions", score: 31 } },
  { id: "3", week: "Week 18", kickoff: "Sat 4:30 PM", status: "Final", away: { team: "Pittsburgh Steelers", score: 10 }, home: { team: "Baltimore Ravens", score: 17 } },
  { id: "4", week: "Week 18", kickoff: "Sun 1:00 PM", status: "Final", away: { team: "New York Jets", score: 9 }, home: { team: "Miami Dolphins", score: 14 } },
  { id: "5", week: "Week 18", kickoff: "Sun 1:00 PM", status: "Final", away: { team: "New England Patriots", score: 16 }, home: { team: "Cincinnati Bengals", score: 23 } },
  { id: "6", week: "Week 18", kickoff: "Sun 1:00 PM", status: "Final", away: { team: "Cleveland Browns", score: 20 }, home: { team: "Houston Texans", score: 27 } },
  { id: "7", week: "Week 18", kickoff: "Sun 1:00 PM", status: "Final", away: { team: "Indianapolis Colts", score: 24 }, home: { team: "Jacksonville Jaguars", score: 21 } },
  { id: "8", week: "Week 18", kickoff: "Sun 1:00 PM", status: "Final", away: { team: "New York Giants", score: 14 }, home: { team: "Washington Commanders", score: 24 } },
  { id: "9", week: "Week 18", kickoff: "Sun 1:00 PM", status: "Final", away: { team: "Atlanta Falcons", score: 21 }, home: { team: "Carolina Panthers", score: 17 } },
  { id: "10", week: "Week 18", kickoff: "Sun 4:05 PM", status: "Final", away: { team: "Tennessee Titans", score: 13 }, home: { team: "Denver Broncos", score: 30 } },
  { id: "11", week: "Week 18", kickoff: "Sun 4:05 PM", status: "Final", away: { team: "Las Vegas Raiders", score: 17 }, home: { team: "Los Angeles Chargers", score: 24 } },
  { id: "12", week: "Week 18", kickoff: "Sun 4:25 PM", status: "Final", away: { team: "Buffalo Bills", score: 24 }, home: { team: "Kansas City Chiefs", score: 27 } },
  { id: "13", week: "Week 18", kickoff: "Sun 4:25 PM", status: "Final", away: { team: "Dallas Cowboys", score: 28 }, home: { team: "Philadelphia Eagles", score: 31 } },
  { id: "14", week: "Week 18", kickoff: "Sun 8:20 PM", status: "Final", away: { team: "Los Angeles Rams", score: 23 }, home: { team: "San Francisco 49ers", score: 30 } },
  { id: "15", week: "Week 18", kickoff: "Sun 8:20 PM", status: "Final", away: { team: "Chicago Bears", score: 20 }, home: { team: "Green Bay Packers", score: 27 } },
  { id: "16", week: "Week 18", kickoff: "Mon 8:15 PM", status: "Final", away: { team: "Arizona Cardinals", score: 16 }, home: { team: "Seattle Seahawks", score: 23 } },
]
