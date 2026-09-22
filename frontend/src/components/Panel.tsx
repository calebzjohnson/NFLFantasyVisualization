// Panel.tsx
// Shared card chrome: titled header with optional actions, wrapping children.
// `expandable` adds an expand/collapse button that re-renders the same
// title/actions/children larger in a modal overlay - the content only ever
// mounts once (inline or in the overlay, never both), so an expandable chart
// doesn't re-fetch or lose state when opened.
import { useEffect, useState, type ReactNode } from "react"

interface PanelProps {
  title: string
  actions?: ReactNode
  className?: string
  expandable?: boolean
  children: ReactNode
}

function Panel({ title, actions, className = "", expandable = false, children }: PanelProps) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [expanded])

  const expandButton = expandable && (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      aria-label={expanded ? "Collapse" : "Expand"}
      className="rounded px-1.5 py-0.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
    >
      {expanded ? "✕" : "⤢"}
    </button>
  )

  const card = (
    <section
      className={`overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-1)] shadow-lg shadow-black/30 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-wider text-[var(--text-primary)] uppercase">
          <span className="h-4 w-1 rounded-sm bg-[var(--accent)]" aria-hidden="true" />
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {actions}
          {expandButton}
        </div>
      </div>
      {children}
    </section>
  )

  if (expandable && expanded) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        onClick={() => setExpanded(false)}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className="max-h-[90vh] w-full max-w-2xl overflow-auto"
        >
          {card}
        </div>
      </div>
    )
  }

  return card
}

export default Panel
