// chartMarks.test.ts
// Tests that a pointer means the nearest mark within reach (not whichever is on top), the mark under a finger, and mouse-only hover tracking.
import { act, renderHook } from "@testing-library/react"
import type * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { markUnder, nearestMarkAt, REACH, useHoveredMark } from "./chartMarks"

// jsdom has no layout: give the chart and each mark a box by hand.
function place(el: Element, x: number, y: number, width: number, height: number) {
  el.getBoundingClientRect = () => ({ x, y, width, height, left: x, top: y, right: x + width, bottom: y + height }) as DOMRect
}

// A 300x200 chart at the page origin with marks centered on the given points,
// in draw order (later marks are on top).
function chart(...centers: [string, number, number][]) {
  const root = document.createElement("div")
  root.setAttribute("data-chart-marks", "")
  place(root, 0, 0, 300, 200)
  for (const [key, x, y] of centers) {
    const mark = document.createElement("div")
    mark.setAttribute("data-tap-key", key)
    place(mark, x - 10, y - 10, 20, 20)
    root.append(mark)
  }
  document.body.append(root)
  return root
}

function pointAt(el: Element) {
  document.elementFromPoint = vi.fn(() => el)
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("nearestMarkAt", () => {
  it("picks the closest mark, even when a farther one is on top", () => {
    // B is drawn later (on top) and its box covers the point, but A's center is closer.
    const root = chart(["A", 100, 100], ["B", 112, 100])
    pointAt(root.lastElementChild!)
    expect(nearestMarkAt(104, 100)).toBe("A")
  })

  it("finds a mark the pointer is near but not on", () => {
    pointAt(chart(["A", 100, 100]))
    expect(nearestMarkAt(100 + REACH - 1, 100)).toBe("A")
  })

  it("finds nothing past reach, or outside any chart", () => {
    const root = chart(["A", 100, 100])
    pointAt(root)
    expect(nearestMarkAt(100 + REACH + 1, 100)).toBeNull()
    pointAt(document.body)
    expect(nearestMarkAt(100, 100)).toBeNull()
  })

  it("breaks a tie toward the mark drawn on top", () => {
    pointAt(chart(["A", 90, 100], ["B", 110, 100]))
    expect(nearestMarkAt(100, 100)).toBe("B")
  })
})

describe("markUnder", () => {
  it("is the mark the point lands on, whatever is closer", () => {
    const root = chart(["A", 100, 100], ["B", 112, 100])
    pointAt(root.lastElementChild!)
    expect(markUnder(104, 100)).toBe("B")
  })
})

describe("useHoveredMark", () => {
  function move(result: { current: ReturnType<typeof useHoveredMark> }, root: HTMLElement, pointerType: string, x: number, y: number) {
    act(() =>
      result.current.hoverHandlers.onPointerMove({ pointerType, currentTarget: root, clientX: x, clientY: y } as unknown as React.PointerEvent<HTMLElement>),
    )
  }

  it("tracks the mouse's nearest mark, centered relative to the chart", () => {
    const root = chart(["A", 100, 100], ["B", 200, 50])
    const { result } = renderHook(() => useHoveredMark())
    move(result, root, "mouse", 190, 60)
    expect(result.current.hovered).toEqual({ key: "B", x: 200, y: 50, width: root.scrollWidth, height: root.clientHeight })

    move(result, root, "mouse", 150, 150)
    expect(result.current.hovered).toBeNull()
  })

  it("ignores touch, and clears when the mouse leaves", () => {
    const root = chart(["A", 100, 100])
    const { result } = renderHook(() => useHoveredMark())
    move(result, root, "touch", 100, 100)
    expect(result.current.hovered).toBeNull()

    move(result, root, "mouse", 100, 100)
    expect(result.current.hovered?.key).toBe("A")
    act(() => result.current.hoverHandlers.onPointerLeave())
    expect(result.current.hovered).toBeNull()
  })
})
