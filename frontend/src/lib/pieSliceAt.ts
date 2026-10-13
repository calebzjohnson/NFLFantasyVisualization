// pieSliceAt.ts
// Which slice of a recharts donut is at a screen point, by its index in the Pie's data (recharts draws one sector group per row, in data order).
export function pieSliceAt(clientX: number, clientY: number): number | null {
  const sector = document.elementFromPoint(clientX, clientY)?.closest(".recharts-pie-sector")
  if (!sector?.parentElement) return null
  const index = [...sector.parentElement.children].filter((el) => el.classList.contains("recharts-pie-sector")).indexOf(sector)
  return index === -1 ? null : index
}
