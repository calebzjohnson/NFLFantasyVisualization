// leaderMovement.test.ts
// Tests for rebuilding last week's stat-leader places from game rows.
import { describe, expect, it } from "vitest"
import { LEADER_CATEGORIES, type RawPlayerRow } from "./leaderCategories"
import { competitionRanks, previousRanks, weeklyLeaderPath } from "./leaderMovement"

const passing = LEADER_CATEGORIES.find((category) => category.position === "QB")!

function game(playerId: string, week: number, passingYards: number | null): RawPlayerRow {
  return { player_id: playerId, week, passing_yards: passingYards } as unknown as RawPlayerRow
}

describe("weeklyLeaderPath", () => {
  it("asks /players/weekly for the category's stat fields plus the week", () => {
    const params = new URL(weeklyLeaderPath(passing), "http://x").searchParams

    expect(params.get("position_group")).toBe("QB")
    expect(params.get("fields")).toBe(
      "player_id,completions,attempts,passing_yards,passing_tds,passing_interceptions,fumbles_lost_total,week",
    )
  })
})

describe("competitionRanks", () => {
  it("gives tied values the same place and skips the places they share", () => {
    const ranks = competitionRanks(new Map([["a", 5], ["b", 9], ["c", 5], ["d", 1]]))
    expect(Object.fromEntries(ranks)).toEqual({ b: 1, a: 2, c: 2, d: 4 })
  })
})

describe("previousRanks", () => {
  it("ranks on totals from before the latest week only", () => {
    const weekly = [game("A", 1, 100), game("A", 2, 100), game("B", 1, 150), game("B", 3, 900)]
    const ranks = previousRanks(passing, ["A", "B"], weekly, 3)!

    expect(Object.fromEntries(ranks)).toEqual({ A: 1, B: 2 }) // 200 vs 150
  })

  it("counts a player with no earlier games, or only null stats, as 0", () => {
    const weekly = [game("A", 1, 50), game("B", 1, null), game("C", 2, 400)]
    const ranks = previousRanks(passing, ["A", "B", "C"], weekly, 2)!

    expect(Object.fromEntries(ranks)).toEqual({ A: 1, B: 2, C: 2 })
  })

  it("is null when there's no earlier week to compare to", () => {
    expect(previousRanks(passing, ["A"], [game("A", 1, 300)], 1)).toBeNull()
  })
})
