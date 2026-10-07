// activateOnKey.test.ts
// Tests that chart markers with role="button" activate on Enter and Space (without scrolling), and ignore other keys.
import type { KeyboardEvent } from "react"
import { describe, expect, it, vi } from "vitest"
import { activateOnKey } from "./activateOnKey"

function press(key: string) {
  const action = vi.fn()
  const event = { key, preventDefault: vi.fn() } as unknown as KeyboardEvent
  activateOnKey(action)(event)
  return { action, preventDefault: event.preventDefault }
}

describe("activateOnKey", () => {
  it.each(["Enter", " "])("activates on %j and prevents the default", (key) => {
    const { action, preventDefault } = press(key)
    expect(action).toHaveBeenCalledOnce()
    expect(preventDefault).toHaveBeenCalledOnce()
  })

  it("ignores other keys, leaving Tab and arrows alone", () => {
    for (const key of ["Tab", "ArrowDown", "a"]) {
      const { action, preventDefault } = press(key)
      expect(action).not.toHaveBeenCalled()
      expect(preventDefault).not.toHaveBeenCalled()
    }
  })
})
