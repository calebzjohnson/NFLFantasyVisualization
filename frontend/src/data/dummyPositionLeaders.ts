import { DUMMY_LEADERS } from "./dummyLeaders"
import type { LeaderCategory } from "./leaderTypes"

// Reuse the existing passing/rushing/receiving leader rows where the metric is
// identical, instead of authoring separate fictional data for the same stat.
const passing = DUMMY_LEADERS.find((c) => c.title === "Passing")!
const rushing = DUMMY_LEADERS.find((c) => c.title === "Rushing")!
const receiving = DUMMY_LEADERS.find((c) => c.title === "Receiving")!

// Placeholder data. Fictional players — to be replaced by live data from the backend.
export const OFFENSE_POSITION_LEADERS: LeaderCategory[] = [
  { title: "QB", unit: passing.unit, rows: passing.rows },
  { title: "RB", unit: rushing.unit, rows: rushing.rows },
  { title: "WR", unit: receiving.unit, rows: receiving.rows },
  {
    title: "TE",
    unit: "yds",
    rows: [
      { rank: 1, player: "G. Hutchins", team: "KC", value: 512 },
      { rank: 2, player: "J. Almeida", team: "LV", value: 478 },
      { rank: 3, player: "B. Castellano", team: "NYG", value: 445 },
      { rank: 4, player: "T. Ferreira", team: "JAX", value: 412 },
      { rank: 5, player: "W. Onyango", team: "IND", value: 389 },
    ],
  },
  {
    title: "OL",
    unit: "%",
    rows: [
      { rank: 1, player: "R. Kowalczyk", team: "PHI", value: 3.2 },
      { rank: 2, player: "D. Ssebunya", team: "SF", value: 3.6 },
      { rank: 3, player: "M. Lindqvist", team: "DET", value: 3.9 },
      { rank: 4, player: "A. Petrovic", team: "BUF", value: 4.1 },
      { rank: 5, player: "C. Adeyemi", team: "DAL", value: 4.4 },
    ],
  },
]

export const DEFENSE_POSITION_LEADERS: LeaderCategory[] = [
  {
    title: "DL",
    unit: "%",
    rows: [
      { rank: 1, player: "K. Osagie", team: "PIT", value: 19.8 },
      { rank: 2, player: "J. Vermeulen", team: "NYJ", value: 18.3 },
      { rank: 3, player: "T. Nakashima", team: "LAC", value: 17.1 },
      { rank: 4, player: "M. Boykins", team: "CLE", value: 16.4 },
      { rank: 5, player: "D. Falkenrath", team: "GB", value: 15.9 },
    ],
  },
  {
    title: "LB",
    unit: "tkl",
    rows: [
      { rank: 1, player: "S. Odutayo", team: "BAL", value: 94 },
      { rank: 2, player: "R. Kavanagh", team: "SEA", value: 88 },
      { rank: 3, player: "J. Marchetti", team: "IND", value: 83 },
      { rank: 4, player: "L. Bergström", team: "DEN", value: 79 },
      { rank: 5, player: "D. Chikere", team: "CHI", value: 75 },
    ],
  },
  {
    title: "CB",
    unit: "yds/snap",
    rows: [
      { rank: 1, player: "P. Delacroix", team: "NE", value: 0.48 },
      { rank: 2, player: "A. Whitlock", team: "MIA", value: 0.53 },
      { rank: 3, player: "K. Osei-Bonsu", team: "DAL", value: 0.57 },
      { rank: 4, player: "N. Ravndal", team: "TB", value: 0.61 },
      { rank: 5, player: "J. Bouchard", team: "ARI", value: 0.64 },
    ],
  },
  {
    title: "S",
    unit: "tkl",
    rows: [
      { rank: 1, player: "M. Iversen", team: "KC", value: 91 },
      { rank: 2, player: "T. Adeyinka", team: "SF", value: 86 },
      { rank: 3, player: "C. Whitworth", team: "LAR", value: 81 },
      { rank: 4, player: "R. Solberg", team: "PHI", value: 77 },
      { rank: 5, player: "B. Nakagawa", team: "HOU", value: 72 },
    ],
  },
]
