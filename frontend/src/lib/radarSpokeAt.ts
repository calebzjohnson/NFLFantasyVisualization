// radarSpokeAt.ts
// Which spoke of a recharts radar a screen point is nearest, by angle from the chart's center (recharts starts the first spoke at the top and goes clockwise) - only for points on or near the radar itself.

// How far (px) past the radar's outer ring a point still counts as on it -
// enough to take in the spoke labels just outside the ring.
export const NEAR = 24

// The spoke nearest the direction (dx, dy) from the center, in screen
// coordinates (y grows downward), for a radar with `count` spokes.
export function spokeIndex(dx: number, dy: number, count: number): number {
  // 0 degrees straight up, growing clockwise - the order recharts lays spokes out in.
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI
  return ((Math.round(degrees / (360 / count)) % count) + count) % count
}

// The spoke for a point (dx, dy) from the center of a radar whose outer ring
// has `radius`, or null when the point is further out than the ring plus NEAR.
export function spokeWithin(dx: number, dy: number, radius: number, count: number): number | null {
  return Math.hypot(dx, dy) > radius + NEAR ? null : spokeIndex(dx, dy, count)
}

// The nearest spoke to a screen point on the radar inside `chart`, or null
// when it's away from the radar (or none is drawn). The outer ring is the
// drawn grid's own box, so it follows the chart's size and outer radius.
export function radarSpokeAt(chart: Element, clientX: number, clientY: number, count: number): number | null {
  const grid = chart.querySelector(".recharts-polar-grid")
  if (!grid || count === 0) return null
  const box = grid.getBoundingClientRect()
  const radius = Math.max(box.width, box.height) / 2
  return spokeWithin(clientX - (box.x + box.width / 2), clientY - (box.y + box.height / 2), radius, count)
}
