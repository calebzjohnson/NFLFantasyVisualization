import type { DetailedLeaderCategory } from "./leaderStatsTypes"

// Placeholder data. Fictional stat lines — to be replaced by live data from the backend.
export const DETAILED_LEADER_CATEGORIES: DetailedLeaderCategory[] = [
  {
    key: "passing",
    label: "Passing",
    columns: [
      { key: "cmp", label: "CMP" },
      { key: "att", label: "ATT" },
      { key: "yards", label: "YARDS" },
      { key: "td", label: "TD" },
      { key: "int", label: "INT" },
      { key: "rating", label: "RATING" },
    ],
    rows: [
      { rank: 1, player: "Patrick Mahomes", team: "Kansas City Chiefs", stats: { cmp: 401, att: 597, yards: 4183, td: 27, int: 14, rating: 92.6 } },
      { rank: 2, player: "Tua Tagovailoa", team: "Miami Dolphins", stats: { cmp: 388, att: 560, yards: 4624, td: 29, int: 14, rating: 101.1 } },
      { rank: 3, player: "Brock Purdy", team: "San Francisco 49ers", stats: { cmp: 308, att: 444, yards: 4280, td: 31, int: 11, rating: 113.0 } },
      { rank: 4, player: "Jared Goff", team: "Detroit Lions", stats: { cmp: 407, att: 605, yards: 4575, td: 30, int: 12, rating: 97.9 } },
      { rank: 5, player: "Dak Prescott", team: "Dallas Cowboys", stats: { cmp: 410, att: 590, yards: 4516, td: 36, int: 9, rating: 105.9 } },
    ],
  },
  {
    key: "receiving",
    label: "Receiving",
    columns: [
      { key: "rec", label: "REC" },
      { key: "tgt", label: "TGT" },
      { key: "yards", label: "YARDS" },
      { key: "td", label: "TD" },
      { key: "ypr", label: "YPR" },
    ],
    rows: [
      { rank: 1, player: "Ja'Marr Chase", team: "Cincinnati Bengals", stats: { rec: 112, tgt: 156, yards: 1612, td: 11, ypr: 14.4 } },
      { rank: 2, player: "CeeDee Lamb", team: "Dallas Cowboys", stats: { rec: 108, tgt: 149, yards: 1521, td: 9, ypr: 14.1 } },
      { rank: 3, player: "Amon-Ra St. Brown", team: "Detroit Lions", stats: { rec: 104, tgt: 142, yards: 1394, td: 10, ypr: 13.4 } },
      { rank: 4, player: "Justin Jefferson", team: "Minnesota Vikings", stats: { rec: 98, tgt: 138, yards: 1367, td: 8, ypr: 13.9 } },
      { rank: 5, player: "A.J. Brown", team: "Philadelphia Eagles", stats: { rec: 95, tgt: 131, yards: 1298, td: 7, ypr: 13.7 } },
    ],
  },
  {
    key: "rushing",
    label: "Rushing",
    columns: [
      { key: "att", label: "ATT" },
      { key: "yards", label: "YARDS" },
      { key: "td", label: "TD" },
      { key: "ypc", label: "YPC" },
    ],
    rows: [
      { rank: 1, player: "Christian McCaffrey", team: "San Francisco 49ers", stats: { att: 272, yards: 1459, td: 14, ypc: 5.4 } },
      { rank: 2, player: "Derrick Henry", team: "Baltimore Ravens", stats: { att: 280, yards: 1421, td: 16, ypc: 5.1 } },
      { rank: 3, player: "Saquon Barkley", team: "Philadelphia Eagles", stats: { att: 265, yards: 1398, td: 12, ypc: 5.3 } },
      { rank: 4, player: "Bijan Robinson", team: "Atlanta Falcons", stats: { att: 248, yards: 1211, td: 9, ypc: 4.9 } },
      { rank: 5, player: "Jahmyr Gibbs", team: "Detroit Lions", stats: { att: 220, yards: 1147, td: 11, ypc: 5.2 } },
    ],
  },
]
