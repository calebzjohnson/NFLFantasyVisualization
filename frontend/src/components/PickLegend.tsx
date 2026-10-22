// PickLegend.tsx
// Color key for the Create page's picks on a chart (a dot and a name each), so a chart pinning picks reads on its own without the form above it.

// One pick a chart draws in its own color, on top of everyone else.
export interface Pin {
  id: string
  name: string
  color: string
}

function PickLegend({ pins }: { pins: Pin[] }) {
  return (
    <ul aria-label="Picks" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
      {pins.map((pin) => (
        <li key={pin.id} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pin.color }} aria-hidden="true" />
          {pin.name}
        </li>
      ))}
    </ul>
  )
}

export default PickLegend
