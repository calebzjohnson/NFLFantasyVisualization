// useTapToOpen.test.ts
// Tests for chart-mark taps: a mouse click opens at once; a touch tap selects, and a second tap on the same mark opens it.
import { act, renderHook } from "@testing-library/react"
import type * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { useTapToOpen } from "./useTapToOpen"

function setup() {
  const open = vi.fn()
  const { result } = renderHook(() => useTapToOpen<string>(open))
  // A click is always preceded by its pointerdown, which records the input type.
  const click = (pointerType: string, id: string | null) =>
    act(() => {
      result.current.onPointerDown({ pointerType } as React.PointerEvent)
      result.current.tap(id)
    })
  return { open, result, click }
}

describe("useTapToOpen", () => {
  it("opens a mark on a mouse click, without selecting it", () => {
    const { open, result, click } = setup()
    click("mouse", "KC")
    expect(open).toHaveBeenCalledWith("KC")
    expect(result.current.selected).toBeNull()
  })

  it("selects a mark on the first tap and opens it on the second", () => {
    const { open, result, click } = setup()
    click("touch", "KC")
    expect(result.current.selected).toBe("KC")
    expect(open).not.toHaveBeenCalled()

    click("touch", "KC")
    expect(open).toHaveBeenCalledWith("KC")
  })

  it("moves the selection when a different mark is tapped", () => {
    const { open, result, click } = setup()
    click("touch", "KC")
    click("touch", "BUF")
    expect(result.current.selected).toBe("BUF")
    expect(open).not.toHaveBeenCalled()
  })

  it("clears the selection on a tap on empty chart space", () => {
    const { open, result, click } = setup()
    click("touch", "KC")
    click("touch", null)
    expect(result.current.selected).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })
})
