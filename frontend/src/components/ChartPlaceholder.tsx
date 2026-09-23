// ChartPlaceholder.tsx
// Generic dashed placeholder for a not-yet-built chart panel.
import Panel from "./Panel"

function ChartPlaceholder({
  title,
  description,
  aspectClassName = "aspect-[4/3]",
}: {
  title: string
  description: string
  aspectClassName?: string
}) {
  return (
    <Panel title={title}>
      <div
        className={`m-4 flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] ${aspectClassName}`}
      >
        <p className="max-w-xs px-4 text-center text-sm text-[var(--text-muted)]">{description}</p>
      </div>
    </Panel>
  )
}

export default ChartPlaceholder
