// site.test.ts
// Tests index.html's static head (title matches the site name, meta description, icons), robots.txt,
// and the touch-zoom guard in src/index.css.
import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { SITE_NAME } from "./src/lib/site.ts"

const html = readFileSync("index.html", "utf8")

describe("index.html", () => {
  it("uses the site name as the title shown before the app loads", () => {
    expect(html).toContain(`<title>${SITE_NAME}</title>`)
  })

  it("has a meta description for search results", () => {
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]{50,160}"/)
  })

  it("links a favicon and an apple-touch-icon that exist in public/", () => {
    for (const [rel, file] of [
      ["icon", "favicon.svg"],
      ["apple-touch-icon", "apple-touch-icon.png"],
    ]) {
      expect(html).toMatch(new RegExp(`<link rel="${rel}"[^>]*href="/${file}"`))
      expect(existsSync(`public/${file}`)).toBe(true)
    }
  })

  // Pinch-zoom must stay available; the touch-zoom fix lives in CSS instead.
  it("doesn't disable zooming in the viewport meta", () => {
    expect(html).not.toMatch(/maximum-scale|user-scalable/)
  })
})

describe("src/index.css", () => {
  // iOS Safari zooms into a focused field under 16px; the fields use text-sm (14px).
  it("gives form fields 16px text on touchscreens so focusing one doesn't zoom the page", () => {
    const css = readFileSync("src/index.css", "utf8")
    expect(css).toMatch(/@media \(hover: none\) \{\s*input,\s*select,\s*textarea \{\s*font-size: 16px;/)
  })
})

describe("robots.txt", () => {
  // Without a real file, the SPA rewrite would answer /robots.txt with index.html.
  it("exists as a plain robots file allowing crawlers", () => {
    const robots = readFileSync("public/robots.txt", "utf8")
    expect(robots).toMatch(/^User-agent: \*$/m)
    expect(robots).toMatch(/^Allow: \/$/m)
    expect(robots).not.toContain("<")
  })
})
