// vercel.test.ts
// Tests vercel.json: SPA rewrite scope, security headers, and that the CSP allows the image hosts we render.
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { teamLogoUrl } from "./src/lib/imageUrls.ts"

interface VercelConfig {
  rewrites: { source: string; destination: string }[]
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

const config = JSON.parse(readFileSync("vercel.json", "utf8")) as VercelConfig
const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]))
const csp = Object.fromEntries(
  headers["Content-Security-Policy"].split(";").map((directive) => {
    const [name, ...sources] = directive.trim().split(/\s+/)
    return [name, sources]
  }),
)

describe("vercel.json", () => {
  const rewrite = config.rewrites[0]
  const rewrites = (path: string) => new RegExp(`^${rewrite.source}$`).test(path)

  it("serves index.html for client-side routes", () => {
    expect(rewrite.destination).toBe("/index.html")
    for (const path of ["/", "/players", "/players/00-0033873", "/teams/KC", "/about"]) {
      expect(rewrites(path)).toBe(true)
    }
  })

  it("lets a missing hashed asset 404 instead of returning index.html", () => {
    expect(rewrites("/assets/index-old.js")).toBe(false)
  })

  it("sends every security header on all routes", () => {
    expect(config.headers[0].source).toBe("/(.*)")
    expect(headers).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    })
    expect(csp["frame-ancestors"]).toEqual(["'none'"])
    expect(csp["object-src"]).toEqual(["'none'"])
  })

  it("allows the image hosts the site renders", () => {
    const logoOrigin = new URL(teamLogoUrl("https://a.espncdn.com/i/teamlogos/nfl/500/kc.png")).origin
    expect(csp["img-src"]).toContain(logoOrigin)
    expect(csp["img-src"]).toContain("https://static.www.nfl.com") // nflverse headshots
  })
})
