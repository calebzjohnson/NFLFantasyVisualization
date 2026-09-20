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
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--text-primary)] uppercase">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

export default Panel
