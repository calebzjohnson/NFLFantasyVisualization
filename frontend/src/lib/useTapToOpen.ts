// useTapToOpen.ts
// Chart marks that open a page: a mouse click opens it straight away; a tap (which can't hover first) selects the mark, and a second tap on it opens it.
import { useRef, useState } from "react"
import type * as React from "react"

export function useTapToOpen<Id>(open: (id: Id) => void) {
  // The input behind the click about to arrive, recorded on pointerdown
  // (clicks don't reliably carry their pointer type across browsers).
  const pointerType = useRef("mouse")
  const [selected, setSelected] = useState<Id | null>(null)

  return {
    // The mark a tap selected, for highlighting it and showing its details.
    selected,
    // Put on the element wrapping the chart.
    onPointerDown: (event: React.PointerEvent) => {
      pointerType.current = event.pointerType
    },
    // A click on a mark, or on empty chart space (null), which clears the selection.
    tap(id: Id | null) {
      if (id === null) setSelected(null)
      else if (pointerType.current === "mouse" || id === selected) open(id)
      else setSelected(id)
    },
  }
}
