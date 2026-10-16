// StatGlossary.tsx
// "What do these stats mean?" disclosure under a chart: each stat's name and a plain-language explanation, plus any extra notes as children.
import type { ReactNode } from "react"

export interface GlossaryEntry {
  key: string
  label: string
  text: string | undefined
}

function StatGlossary({ entries, children }: { entries: GlossaryEntry[]; children?: ReactNode }) {
  return (
    <details className="px-3 pb-1 pt-2 text-xs text-[var(--text-muted)]">
      <summary className="-my-1 cursor-pointer py-1 text-[var(--text-secondary)]">What do these stats mean?</summary>
      <dl className="mt-2 grid gap-1.5">
        {entries.map((entry) => (
          <div key={entry.key}>
            <dt className="inline font-medium text-[var(--text-secondary)]">{entry.label}: </dt>
            <dd className="inline">{entry.text ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {children}
    </details>
  )
}

export default StatGlossary
