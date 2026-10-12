// TapDetails.tsx
// Touchscreen stand-in for a chart's hover tooltip: a fixed-height box below the chart showing the tapped mark, and its "View … →" button.
import type { ReactNode } from "react"

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
