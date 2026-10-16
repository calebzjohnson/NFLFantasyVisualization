// radarSpokeAt.test.ts
// Tests that a direction from a radar's center maps to the nearest spoke, starting at the top and going clockwise, and that points away from the radar map to none.
import { describe, expect, it } from "vitest"
import { NEAR, spokeIndex, spokeWithin } from "./radarSpokeAt"

describe("spokeIndex", () => {
  it("starts at the top and goes clockwise", () => {
    expect(spokeIndex(0, -10, 4)).toBe(0) // up
    expect(spokeIndex(10, 0, 4)).toBe(1) // right
    expect(spokeIndex(0, 10, 4)).toBe(2) // down
    expect(spokeIndex(-10, 0, 4)).toBe(3) // left
  })

  it("picks the nearest spoke between two", () => {
    // Six spokes, 60 degrees apart: 20 degrees clockwise of the top is still the first, 40 is the second.
    const at = (degrees: number) => {
      const radians = (degrees * Math.PI) / 180
      return spokeIndex(Math.sin(radians), -Math.cos(radians), 6)
    }
    expect(at(20)).toBe(0)
    expect(at(40)).toBe(1)
    expect(at(-20)).toBe(0)
    expect(at(-40)).toBe(5)
  })
})

describe("spokeWithin", () => {
  it("counts points on the radar and just outside its ring, but not further out", () => {
    expect(spokeWithin(0, -50, 100, 6)).toBe(0)
    expect(spokeWithin(100 + NEAR, 0, 100, 4)).toBe(1)
    expect(spokeWithin(100 + NEAR + 1, 0, 100, 4)).toBeNull()
  })
})
