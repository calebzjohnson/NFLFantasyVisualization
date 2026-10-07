// usePageTitle.test.ts
// Tests the browser tab title format, including the bare site name for the home page.
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { usePageTitle } from "./usePageTitle"

describe("usePageTitle", () => {
  it("suffixes the page with the site name", () => {
    renderHook(() => usePageTitle("Patrick Mahomes"))
    expect(document.title).toBe("Patrick Mahomes · Plot the Pigskin")
  })

  it("uses just the site name without a page", () => {
    renderHook(() => usePageTitle(null))
    expect(document.title).toBe("Plot the Pigskin")
  })

  it("updates when the page changes (e.g. a player's name loads)", () => {
    const { rerender } = renderHook(({ page }) => usePageTitle(page), { initialProps: { page: "Player" } })
    rerender({ page: "Josh Allen" })
    expect(document.title).toBe("Josh Allen · Plot the Pigskin")
  })
})
