// trendingPlayers.test.ts
// Tests for trend slopes, top-5 selection, which players qualify to trend,
// and which of their games count.
import { describe, expect, it } from "vitest"
import { PLAYER_METRICS } from "./playerMetrics"
import { slope, topTrends, trendingPlayers, type TrendLine, type WeeklyPlayerRow } from "./trendingPlayers"

function line(id: string, lineSlope: number): TrendLine {
  return { id, name: id, team: "AAA", headshot: null, slope: lineSlope, games: [] }
}

function week(playerId: string, weekNumber: number, snapShare: number | null, yards: number): WeeklyPlayerRow {
  return {
    player_id: playerId,
    player_display_name: playerId,
    team: "AAA",
    headshot_url: null,
    week: weekNumber,
    offense_snap_pct: snapShare,
    receiving_yards: yards,
  }
}

describe("slope", () => {
  it("is the least-squares slope of y over x", () => {
    expect(slope([{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 3, y: 5 }])).toBe(2)
  })

  it("isn't thrown off by a bye (a gap in x)", () => {
    expect(slope([{ x: 1, y: 10 }, { x: 2, y: 20 }, { x: 4, y: 40 }])).toBeCloseTo(10)
  })

  it("is 0 when every point shares one x", () => {
    expect(slope([{ x: 3, y: 1 }, { x: 3, y: 9 }])).toBe(0)
  })
})

describe("topTrends", () => {
  it("keeps the 5 steepest each way, steepest first, and drops flat lines", () => {
    const lines = [0, 1, 2, 3, 4, 5, 6, -1, -2].map((s) => line(`p${s}`, s))
    const { up, down } = topTrends(lines)

    expect(up.map((l) => l.slope)).toEqual([6, 5, 4, 3, 2])
    expect(down.map((l) => l.slope)).toEqual([-2, -1])
  })
})

describe("trendingPlayers", () => {
  const receivingYards = PLAYER_METRICS.WR.find((m) => m.key === "receiving_yards")!

  it("scores the last-5-week window and skips barely-involved or one-game players", () => {
    const rows = [
      // Rising; week 1 is outside the week 2-6 window, so its 1000 yards are ignored.
      ...[1, 2, 3, 4, 5, 6].map((w) => week("rising", w, 90, w === 1 ? 1000 : w * 10)),
      ...[2, 3, 4, 5, 6].map((w) => week("falling", w, 60, 100 - w * 10)),
      // Under a 20% snap share - garbage time, not a real trend.
      ...[2, 3, 4, 5, 6].map((w) => week("barely-used", w, 10, w * 50)),
      week("one-game", 6, 90, 200),
    ]

    const { up, down } = trendingPlayers(rows, receivingYards, "WR")

    expect(up.map((l) => l.id)).toEqual(["rising"])
    expect(up[0].slope).toBeCloseTo(10)
    expect(down.map((l) => l.id)).toEqual(["falling"])
  })

  it("still trends a player who missed a week, keeping only the weeks played", () => {
    const rows = [week("missed-week-2", 1, 90, 10), week("missed-week-2", 3, 90, 40)]

    const { up } = trendingPlayers(rows, receivingYards, "WR")

    expect(up[0].games.map((g) => g.week)).toEqual([1, 3])
    expect(up[0].slope).toBeCloseTo(15)
  })

  it("drops players who haven't played in the last 2 weeks, but keeps byes and late starters", () => {
    const rows = [
      // Out since week 2 (weeks 3 and 4 missed) - the injured starter.
      ...[1, 2].map((w) => week("injured", w, 90, w * 10)),
      // Missed only the latest week - a bye.
      ...[1, 2, 3].map((w) => week("bye", w, 90, w * 10)),
      // No early games, then started - a practice-squad call-up.
      ...[3, 4].map((w) => week("call-up", w, 90, w * 10)),
    ]

    const { up } = trendingPlayers(rows, receivingYards, "WR")

    expect(up.map((l) => l.id).sort()).toEqual(["bye", "call-up"])
  })

  it("drops a game the player left early, by their own usual snap share", () => {
    const rows = [
      // Left week 3 early (12% of snaps) - that game shouldn't read as a slump.
      week("hurt-in-game", 1, 100, 80), week("hurt-in-game", 2, 100, 90), week("hurt-in-game", 3, 12, 5),
      // A steady 30% part-timer - low share, but every game is their normal.
      ...[1, 2, 3].map((w) => week("part-timer", w, 30, w * 10)),
    ]

    const { up, down } = trendingPlayers(rows, receivingYards, "WR")

    expect(down).toEqual([])
    expect(up.find((l) => l.id === "hurt-in-game")?.games.map((g) => g.week)).toEqual([1, 2])
    expect(up.find((l) => l.id === "part-timer")?.games).toHaveLength(3)
  })

  it("keeps games whose snap counts haven't been published yet", () => {
    const rows = [week("pending", 1, 90, 10), week("pending", 2, null, 30)]

    expect(trendingPlayers(rows, receivingYards, "WR").up[0].games).toHaveLength(2)
  })

  it("trends kickers without any snap share check", () => {
    const fgMade = PLAYER_METRICS.K.find((m) => m.key === "fg_made")!
    // Kickers' real rows carry a 0% offensive snap share.
    const kicker = (w: number, made: number): WeeklyPlayerRow => ({ ...week("kicker", w, 0, 0), fg_made: made })

    expect(trendingPlayers([kicker(1, 1), kicker(2, 3)], fgMade, "K").up.map((l) => l.id)).toEqual(["kicker"])
  })

  it("returns nothing for no rows", () => {
    expect(trendingPlayers([], receivingYards, "WR")).toEqual({ up: [], down: [] })
  })
})
