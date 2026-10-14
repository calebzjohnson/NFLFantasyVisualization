// HighlightPicker.tsx
// Search box beside a chart's axis pickers that picks one mark to highlight, shown as a removable chip.
import { useId, useState } from "react"
import { matchesQuery } from "../data/search"

export interface HighlightOption {
  id: string
  label: string
}

function HighlightPicker({
  noun,
  options,
  picked,
  onPick,
  onClear,
}: {
  // Plural noun for the placeholder, e.g. "players".
  noun: string
  options: HighlightOption[]
  picked: HighlightOption | null
  // A new pick replaces the current one.
  onPick: (id: string) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState("")
  const listId = useId()
  const available = options.filter((option) => option.id !== picked?.id)

  function pick(id: string) {
    onPick(id)
    setQuery("")
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <label className="flex items-center gap-2 text-sm whitespace-nowrap text-[var(--text-secondary)]">
        Highlight
        {/* Native suggestions: choosing one sets the value to an option's exact label. */}
        <input
          type="search"
          list={listId}
          value={query}
          placeholder={`Find ${noun}…`}
          onChange={(event) => {
            const match = available.find((option) => option.label === event.target.value)
            if (match) pick(match.id)
            else setQuery(event.target.value)
          }}
          onKeyDown={(event) => {
            // Enter on a partial name takes the first match, same matching as the site search.
            if (event.key !== "Enter" || !query.trim()) return
            const match = available.find((option) => matchesQuery(option.label, query))
            if (match) {
              event.preventDefault()
              pick(match.id)
            }
          }}
          className="w-44 rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[var(--accent)]"
        />
      </label>
      <datalist id={listId}>
        {available.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>
      {picked && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Stop highlighting ${picked.label}`}
          className="flex items-center gap-1 rounded-full border border-[var(--accent)] px-2.5 py-1 text-sm text-[var(--accent)] hover:bg-[var(--surface-2)] focus:outline-2 focus:outline-[var(--accent)]"
        >
          {picked.label}
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  )
}

export default HighlightPicker
