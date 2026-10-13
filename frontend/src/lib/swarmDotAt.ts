// swarmDotAt.ts
// Which beeswarm dot a press lands on: the one under a mouse, or for a finger the nearest dot within reach, since 3.5px dots packed together can't be hit precisely.
// How far (px) from a finger's touch point a dot still counts as tapped.
export const TOUCH_REACH = 24

// Dots are `[data-tap-key]` groups (each centered on its dot) inside an
// element marked `data-swarm-chart`; a finger only reaches dots in the chart
// it pressed.
export function swarmDotAt(clientX: number, clientY: number, pointerType: string): string | null {
  const at = document.elementFromPoint(clientX, clientY)
  if (pointerType === "mouse") return at?.closest("[data-tap-key]")?.getAttribute("data-tap-key") ?? null
  // Nearest center, not whichever dot's hit area is on top: in a dense
  // cluster the hit areas overlap, and the top one isn't the closest.
  const chart = at?.closest("[data-swarm-chart]")
  if (!chart) return null
  let nearest: string | null = null
  let best = TOUCH_REACH
  for (const dot of chart.querySelectorAll("[data-tap-key]")) {
    const box = dot.getBoundingClientRect()
    const distance = Math.hypot(box.x + box.width / 2 - clientX, box.y + box.height / 2 - clientY)
    if (distance <= best) {
      best = distance
      nearest = dot.getAttribute("data-tap-key")
    }
  }
  return nearest
}
