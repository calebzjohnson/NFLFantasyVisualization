// useTapToOpen.ts
// Chart marks that open a page: a mouse click opens it straight away; a tap (which can't hover first) selects the mark, and a second tap on it opens it.
import { useRef, useState } from "react"
import type * as React from "react"

// A press that moved further than this (px) was a drag or scroll, not a tap.
const TAP_SLOP = 10

export function useTapToOpen<Id>(open: (id: Id) => void) {
  // The input behind the click about to arrive, recorded on pointerdown
  // (clicks don't reliably carry their pointer type across browsers).
  const pointerType = useRef("mouse")
  // Where the current press started, for pressHandlers.
  const press = useRef<{ x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<Id | null>(null)

  function onPointerDown(event: React.PointerEvent) {
    pointerType.current = event.pointerType
  }

  // A click on a mark, or on empty chart space (null), which clears the selection.
  function tap(id: Id | null) {
    if (id === null) setSelected(null)
    else if (pointerType.current === "mouse" || id === selected) open(id)
    else setSelected(id)
  }

  return {
    // The mark a tap selected, for highlighting it and showing its details.
    selected,
    // Put on the element wrapping the chart, when its marks handle clicks themselves.
    onPointerDown,
    tap,
    // Handlers for the element wrapping the chart that resolve each click or
    // tap on pointerup, via `markAt` (the mark at a screen point, or null).
    // For charts whose hover re-renders replace the marks mid-click: the
    // pressed node is gone by mouseup, so the browser never fires the click.
    // A press that moved, or became a scroll (pointercancel), isn't a tap.
    pressHandlers(markAt: (clientX: number, clientY: number) => Id | null) {
      return {
        onPointerDown(event: React.PointerEvent) {
          onPointerDown(event)
          press.current = event.button === 0 ? { x: event.clientX, y: event.clientY } : null
        },
        onPointerCancel() {
          press.current = null
        },
        onPointerUp(event: React.PointerEvent) {
          const start = press.current
          press.current = null
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < TAP_SLOP) {
            tap(markAt(event.clientX, event.clientY))
          }
        },
      }
    },
  }
}
