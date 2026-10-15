// chartMarks.ts
// Which chart mark a pointer means: the nearest mark center within reach (marks are small and packed, so whichever is on top is often not the closest), plus a hook tracking the mouse's nearest mark.
import { useState } from "react"
import type * as React from "react"

// How far (px) from the pointer a mark's center still counts as pointed at.
export const REACH = 20

// Marks are `[data-tap-key]` elements (each centered on its mark) inside an
// element marked `data-chart-marks`; a pointer only reaches marks in its own chart.
function nearestIn(chart: Element, clientX: number, clientY: number): { key: string; x: number; y: number } | null {
  // ponytail: reads every mark's box on each call (~600 on the busiest
  // beeswarm); cache the centers per layout if pointer moves ever stutter.
  let nearest: { key: string; x: number; y: number } | null = null
  let best = REACH
  for (const mark of chart.querySelectorAll("[data-tap-key]")) {
    const box = mark.getBoundingClientRect()
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const distance = Math.hypot(x - clientX, y - clientY)
    // <= so on a tie the later mark wins: it's drawn on top.
    if (distance <= best) {
      best = distance
      nearest = { key: mark.getAttribute("data-tap-key")!, x, y }
    }
  }
  return nearest
}

// The nearest mark to a screen point, for a click or tap (see useTapToOpen's pressHandlers).
export function nearestMarkAt(clientX: number, clientY: number): string | null {
  const chart = document.elementFromPoint(clientX, clientY)?.closest("[data-chart-marks]")
  return chart ? (nearestIn(chart, clientX, clientY)?.key ?? null) : null
}

// The mark under a screen point, ignoring nearer ones (what a finger hits on
// the scatters, whose marks are big enough to aim at).
export function markUnder(clientX: number, clientY: number): string | null {
  return document.elementFromPoint(clientX, clientY)?.closest("[data-tap-key]")?.getAttribute("data-tap-key") ?? null
}

// The mark a mouse is nearest, with its center relative to the chart element
// (scroll included) and that element's size, for placing a HoverCard.
export interface HoveredMark {
  key: string
  x: number
  y: number
  width: number
  height: number
}

// Spread `hoverHandlers` on the `data-chart-marks` element (which must be
// position: relative for the card). Touch has no hover, so it's ignored.
export function useHoveredMark() {
  const [hovered, setHovered] = useState<HoveredMark | null>(null)
  return {
    hovered,
    hoverHandlers: {
      onPointerMove(event: React.PointerEvent<HTMLElement>) {
        if (event.pointerType !== "mouse") return
        const chart = event.currentTarget
        const mark = nearestIn(chart, event.clientX, event.clientY)
        const box = chart.getBoundingClientRect()
        const next = mark && {
          key: mark.key,
          x: mark.x - box.x + chart.scrollLeft,
          y: mark.y - box.y,
          width: chart.scrollWidth,
          height: chart.clientHeight,
        }
        // Same mark, same place: keep the old object so React skips the re-render.
        setHovered((prev) =>
          prev && next && prev.key === next.key && prev.x === next.x && prev.y === next.y ? prev : next,
        )
      },
      onPointerLeave() {
        setHovered(null)
      },
    },
  }
}
