// playmaking.test.ts
// Tests the red-zone share maths, which is the only computation the browser
// does for this tab - everything else arrives ready from the backend.
import { describe, expect, it } from "vitest"
import { redZoneShare, type RedZonePlayer } from "./playmaking"

function player(id: string, touches: number): RedZonePlayer {
  return { player_id: id, name: id, headshot_url: null, touches }
}

describe("redZoneShare", () => {
  it("divides each player's touches by the team's total", () => {
    const shares = redZoneShare(40, [player("A", 20), player("B", 10)])

    expect(shares.map((s) => [s.player.player_id, s.pct])).toEqual([
      ["A", 50],
      ["B", 25],
    ])
  })

  it("keeps only the top five, so the row doesn't wrap", () => {
    const players = ["A", "B", "C", "D", "E", "F", "G"].map((id, index) => player(id, 10 - index))

    expect(redZoneShare(49, players).map((s) => s.player.player_id)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ])
  })

  it("returns nothing when a team has no red zone touches yet", () => {
    expect(redZoneShare(0, [])).toEqual([])
    expect(redZoneShare(0, [player("A", 0)])).toEqual([])
  })
})
