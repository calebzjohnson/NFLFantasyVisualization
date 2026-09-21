// Panel.tsx
// Shared card chrome: titled header with optional actions, wrapping children.
import type { ReactNode } from "react"

interface PanelProps {
  title: string
  actions?: ReactNode
  children: ReactNode
}

function Panel({ title, actions, children }: PanelProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-1)] shadow-lg shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-wider text-[var(--text-primary)] uppercase">
          <span className="h-4 w-1 rounded-sm bg-[var(--accent)]" aria-hidden="true" />
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

export default Panel
