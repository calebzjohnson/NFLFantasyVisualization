import type { LeaderCategory } from "./leaderTypes"

// Placeholder data. Fictional players — to be replaced by live data from the backend.
export const DUMMY_LEADERS: LeaderCategory[] = [
  {
    title: "Passing",
    unit: "yds",
    rows: [
      { rank: 1, player: "J. Carter", team: "DAL", value: 1412 },
      { rank: 2, player: "M. Reyes", team: "KC", value: 1355 },
      { rank: 3, player: "T. Whitfield", team: "BUF", value: 1298 },
      { rank: 4, player: "D. Okafor", team: "SF", value: 1240 },
      { rank: 5, player: "R. Bianchi", team: "MIA", value: 1187 },
    ],
  },
  {
    title: "Receiving",
    unit: "yds",
    rows: [
      { rank: 1, player: "A. Nakamura", team: "CIN", value: 612 },
      { rank: 2, player: "K. Douglas", team: "PHI", value: 588 },
      { rank: 3, player: "L. Fontaine", team: "DET", value: 561 },
      { rank: 4, player: "S. Okonkwo", team: "MIN", value: 534 },
      { rank: 5, player: "B. Vasquez", team: "LAR", value: 509 },
    ],
  },
  {
    title: "Rushing",
    unit: "yds",
    rows: [
      { rank: 1, player: "C. Marsh", team: "BAL", value: 745 },
      { rank: 2, player: "N. Delgado", team: "SEA", value: 701 },
      { rank: 3, player: "E. Thibault", team: "GB", value: 668 },
      { rank: 4, player: "P. Osei", team: "NYJ", value: 632 },
      { rank: 5, player: "H. Sørensen", team: "HOU", value: 598 },
    ],
  },
]
