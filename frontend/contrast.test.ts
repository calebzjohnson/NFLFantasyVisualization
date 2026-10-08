// contrast.test.ts
// Tests that every text color token in index.css meets WCAG AA contrast (4.5:1) on every surface.
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync("src/index.css", "utf8")
const token = (name: string) => {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i").exec(css)
  if (!match) throw new Error(`--${name} not found in index.css`)
  return match[1]
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const SURFACES = ["surface-0", "surface-1", "surface-2"]
// Colors used for text, including accent links and positive/negative values.
const TEXT_TOKENS = ["text-primary", "text-secondary", "text-muted", "accent", "positive", "negative"]

describe("theme contrast", () => {
  it.each(TEXT_TOKENS)("--%s is at least 4.5:1 on every surface", (name) => {
    for (const surface of SURFACES) {
      expect(contrast(token(name), token(surface)), `--${name} on --${surface}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("computes known ratios correctly", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5)
    expect(contrast("#6b6a66", "#f2f2f0")).toBeCloseTo(4.83, 2)
  })
})
