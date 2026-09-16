export interface LeaderRow {
  rank: number
  player: string
  team: string
  yards: number
}

export interface LeaderCategory {
  title: string
  unit: string
  rows: LeaderRow[]
}

// Placeholder data. Fictional players — to be replaced by live data from the backend.
export const DUMMY_LEADERS: LeaderCategory[] = [
  {
    title: "Passing",
    unit: "yds",
    rows: [
      { rank: 1, player: "J. Carter", team: "DAL", yards: 1412 },
      { rank: 2, player: "M. Reyes", team: "KC", yards: 1355 },
      { rank: 3, player: "T. Whitfield", team: "BUF", yards: 1298 },
      { rank: 4, player: "D. Okafor", team: "SF", yards: 1240 },
      { rank: 5, player: "R. Bianchi", team: "MIA", yards: 1187 },
    ],
  },
  {
    title: "Receiving",
    unit: "yds",
    rows: [
      { rank: 1, player: "A. Nakamura", team: "CIN", yards: 612 },
      { rank: 2, player: "K. Douglas", team: "PHI", yards: 588 },
      { rank: 3, player: "L. Fontaine", team: "DET", yards: 561 },
      { rank: 4, player: "S. Okonkwo", team: "MIN", yards: 534 },
      { rank: 5, player: "B. Vasquez", team: "LAR", yards: 509 },
    ],
  },
  {
    title: "Rushing",
    unit: "yds",
    rows: [
      { rank: 1, player: "C. Marsh", team: "BAL", yards: 745 },
      { rank: 2, player: "N. Delgado", team: "SEA", yards: 701 },
      { rank: 3, player: "E. Thibault", team: "GB", yards: 668 },
      { rank: 4, player: "P. Osei", team: "NYJ", yards: 632 },
      { rank: 5, player: "H. Sørensen", team: "HOU", yards: 598 },
    ],
  },
]
