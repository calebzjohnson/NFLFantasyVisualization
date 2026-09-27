// leaderCategories.test.ts
// Tests that every position group has a Stat Leaders category whose query asks for every field it reads.
import { describe, expect, it } from "vitest"
import { readFields } from "../test/readFields"
import { LEADER_CATEGORIES, POSITION_GROUPS, positionPlural } from "./leaderCategories"

describe("LEADER_CATEGORIES", () => {
  it("has exactly one category per position group", () => {
    expect(LEADER_CATEGORIES.map((category) => category.position).sort()).toEqual([...POSITION_GROUPS].sort())
  })

  it.each(LEADER_CATEGORIES.map((category) => [category.position, category] as const))(
    "%s requests every field its stats read, and sorts by one of its own columns",
    (_, category) => {
      const params = new URL(category.path, "http://x").searchParams
      const requested = params.get("fields")!.split(",")

      expect(requested).toEqual(expect.arrayContaining(readFields(category.toStats)))
      expect(category.columns.map((column) => column.key)).toContain(category.defaultSortKey)
      expect(Object.keys(category.toStats(Object.fromEntries(requested.map((f) => [f, 1])) as never))).toEqual(
        category.columns.map((column) => column.key),
      )
    },
  )

  it("filters the new groups by position", () => {
    for (const position of ["DL", "LB", "DB", "OL", "K", "P"] as const) {
      const category = LEADER_CATEGORIES.find((c) => c.position === position)!
      expect(new URL(category.path, "http://x").searchParams.get("position_group")).toBe(position)
    }
  })

  it("computes a DB's passer rating allowed from his coverage counts", () => {
    const coverage = LEADER_CATEGORIES.find((c) => c.position === "DB")!
    const stats = coverage.toStats({
      player_id: "D1",
      player_display_name: "D One",
      recent_team: "DAL",
      headshot_url: null,
      def_tackles_solo: 3,
      def_tackles_with_assist: 1,
      def_tackle_assists: 2,
      def_interceptions: 1,
      def_pass_defended: 4,
      def_targets: 30,
      def_completions_allowed: 20,
      def_yards_allowed: 250,
      def_receiving_td_allowed: 2,
    })
    expect(stats).toMatchObject({ tkl: 6, tgt: 30, ratingAllowed: 100.7 })
  })
})

describe("positionPlural", () => {
  it("spells out kickers and punters, and adds an s otherwise", () => {
    expect(positionPlural("K")).toBe("kickers")
    expect(positionPlural("P")).toBe("punters")
    expect(positionPlural("DB")).toBe("DBs")
  })
})
