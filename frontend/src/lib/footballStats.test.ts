// footballStats.test.ts
// Tests for the passer rating and per-attempt formulas.
import { describe, expect, it } from "vitest"
import { passerRating, perAttempt } from "./footballStats"

describe("passerRating", () => {
  it("caps a perfect game at 158.3", () => {
    expect(passerRating(20, 20, 300, 3, 0)).toBe(158.3)
  })

  it("floors a disastrous game at 0", () => {
    expect(passerRating(0, 10, 0, 0, 10)).toBe(0)
  })

  it("matches the NFL formula for a typical line", () => {
    // 20/30, 250 yds, 2 TD, 1 INT
    expect(passerRating(20, 30, 250, 2, 1)).toBe(100.7)
  })

  it("returns 0 with no attempts instead of dividing by zero", () => {
    expect(passerRating(0, 0, 0, 0, 0)).toBe(0)
  })
})

describe("perAttempt", () => {
  it("rounds to one decimal", () => {
    expect(perAttempt(95, 20)).toBe(4.8)
  })

  it("returns 0 with no attempts", () => {
    expect(perAttempt(10, 0)).toBe(0)
  })
})
