// playerVisuals.test.ts
// Tests for player initials and text-on-team-color contrast.
import { describe, expect, it } from "vitest"
import { initialsFor, readableTextColor } from "./playerVisuals"

describe("initialsFor", () => {
  it("uses the first letters of the first two words", () => {
    expect(initialsFor("Patrick Mahomes")).toBe("PM")
  })

  it("uses the second word, not the last, for compound surnames", () => {
    expect(initialsFor("Amon-Ra St. Brown")).toBe("AS")
  })

  it("uses the first two letters of a single name", () => {
    expect(initialsFor("Pelé")).toBe("PE")
  })

  it("falls back to ? for a blank name", () => {
    expect(initialsFor("   ")).toBe("?")
  })
})

describe("readableTextColor", () => {
  it("uses dark text on light colors", () => {
    expect(readableTextColor("#ffffff")).toBe("#0b0b0b")
  })

  it("uses light text on dark colors", () => {
    expect(readableTextColor("#000000")).toBe("#ffffff")
  })

  it("falls back to dark text for anything that isn't a 6-digit hex", () => {
    expect(readableTextColor("var(--accent)")).toBe("#0b0b0b")
  })
})
