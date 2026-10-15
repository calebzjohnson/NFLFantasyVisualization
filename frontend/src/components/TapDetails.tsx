// TapDetails.tsx
// A chart's mark details: on a touchscreen a fixed-height box below the chart (with a "View … →" button), and with a mouse a card beside the nearest mark.
import type { ReactNode } from "react"
import type { HoveredMark } from "../lib/chartMarks"

// `className` sets the box's min height to the filled box's, so the first
// tap (or switching marks) doesn't push the content below it around.
export function TapDetails({ prompt, className, children }: { prompt: string; className: string; children: ReactNode }) {
  return (
    <div
      aria-live="polite"
      className={`mt-2 flex flex-col justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-xs ${className}`}
    >
      {children ?? <p className="text-center text-[var(--text-muted)]">{prompt}</p>}
    </div>
  )
}

export function OpenButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-3 py-1.5 font-medium text-[var(--accent)] hover:bg-[var(--surface-2)]"
    >
      View {name} →
    </button>
  )
}

// Desktop tooltip for the mark nearest the mouse (see useHoveredMark): beside
// the mark, on the side facing the chart's middle so it stays inside the chart.
// Mouse-only and not interactive, so it never catches the pointer. w-max: an
// absolute box otherwise shrinks to the space between its anchor and the chart's edge.
export function HoverCard({ mark, children }: { mark: HoveredMark; children: ReactNode }) {
  const toLeft = mark.x > mark.width / 2
  const above = mark.y > mark.height / 2
  return (
    <div
      data-hover-card
      className="pointer-events-none absolute z-10 grid w-max min-w-36 gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/70 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm"
      style={{
        left: mark.x,
        top: mark.y,
        transform: `translate(${toLeft ? "calc(-100% - 14px)" : "14px"}, ${above ? "calc(-100% - 14px)" : "14px"})`,
      }}
    >
      {children}
    </div>
  )
}
