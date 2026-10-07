// Panel.tsx
// Shared card chrome: titled header with optional actions, wrapping children.
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

interface PanelProps {
  title: string
  // Makes the title a link. Kept separate from `title` rather than widening it
  // to ReactNode, so callers can't break the header's typography.
  titleHref?: string
  actions?: ReactNode
  className?: string
  children: ReactNode
}

function Panel({ title, titleHref, actions, className = "", children }: PanelProps) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-1)] shadow-lg shadow-black/30 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-wider text-[var(--text-primary)] uppercase">
          <span className="h-4 w-1 rounded-sm bg-[var(--accent)]" aria-hidden="true" />
          {titleHref ? (
            <Link to={titleHref} className="hover:text-[var(--accent)] hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

export default Panel
