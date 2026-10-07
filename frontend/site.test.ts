// site.test.ts
// Tests index.html's static branding: the title matches the site name used for page titles, and its icons exist.
import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { SITE_NAME } from "./src/lib/site.ts"

const html = readFileSync("index.html", "utf8")

describe("index.html", () => {
  it("uses the site name as the title shown before the app loads", () => {
    expect(html).toContain(`<title>${SITE_NAME}</title>`)
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
})
