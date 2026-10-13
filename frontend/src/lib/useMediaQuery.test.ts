// useMediaQuery.test.ts
// Tests for the media query hook: reports the current match and re-renders when it changes.
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PHONE_QUERY, useMediaQuery } from "./useMediaQuery"

// A matchMedia whose answer the test can flip, notifying subscribers like a resize would.
function stubMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return matches
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }))
  return {
    set(next: boolean) {
      matches = next
      listeners.forEach((listener) => listener())
    },
    listeners,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useMediaQuery", () => {
  it("reports whether the query matches now", () => {
    stubMatchMedia(true)
    expect(renderHook(() => useMediaQuery(PHONE_QUERY)).result.current).toBe(true)
  })

  it("re-renders when the screen crosses the breakpoint", () => {
    const media = stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery(PHONE_QUERY))
    expect(result.current).toBe(false)

    act(() => media.set(true))
    expect(result.current).toBe(true)
  })

  it("stops listening on unmount", () => {
    const media = stubMatchMedia(false)
    const { unmount } = renderHook(() => useMediaQuery(PHONE_QUERY))
    expect(media.listeners.size).toBe(1)
    unmount()
    expect(media.listeners.size).toBe(0)
  })
})
