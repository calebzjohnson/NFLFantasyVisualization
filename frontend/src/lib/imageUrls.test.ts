// imageUrls.test.ts
// Tests for the headshot and team logo CDN-resize URL rewrites.
import { describe, expect, it } from "vitest"
import { headshotUrl, teamLogoUrl } from "./imageUrls"

const HEADSHOT = "https://static.www.nfl.com/image/upload/f_auto,q_auto/league/abc123"

describe("headshotUrl", () => {
  it("adds a size and face crop to the CDN transform", () => {
    expect(headshotUrl(HEADSHOT)).toBe(
      "https://static.www.nfl.com/image/upload/f_auto,q_auto:best,w_192,h_192,c_fill,g_face/league/abc123",
    )
  })

  it("asks the CDN for a round crop when requested", () => {
    expect(headshotUrl(HEADSHOT, 128, true)).toContain("w_128,h_128,c_fill,g_face,r_max/")
  })

  it("passes through a URL without the transform segment", () => {
    expect(headshotUrl("https://example.com/photo.png")).toBe("https://example.com/photo.png")
  })
})

describe("teamLogoUrl", () => {
  it("routes an ESPN logo through ESPN's resizer", () => {
    expect(teamLogoUrl("https://a.espncdn.com/i/teamlogos/nfl/500/kc.png")).toBe(
      "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/kc.png&w=64&h=64",
    )
  })

  it("passes through a non-ESPN URL", () => {
    expect(teamLogoUrl("https://example.com/logo.png")).toBe("https://example.com/logo.png")
  })
})
