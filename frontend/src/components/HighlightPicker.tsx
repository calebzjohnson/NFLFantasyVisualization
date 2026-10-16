// HighlightPicker.tsx
// Search box above a chart that picks one mark to highlight; while one is picked, a chip that clears it takes the box's place.
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
  onPick: (id: string) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState("")
  const listId = useId()

  function pick(id: string) {
    onPick(id)
    setQuery("")
  }

  // The chip takes the search box's place (same size) rather than sitting
  // beside it: on a phone a chip beside it wraps to a new line, and that
  // shift moves the chart out from under a second tap.
  if (picked) {
    return (
      <div className="flex items-center gap-2 text-sm whitespace-nowrap text-[var(--text-secondary)]">
        Highlight
        <button
          type="button"
          onClick={onClear}
          aria-label={`Stop highlighting ${picked.label}`}
          title={picked.label}
          className="flex w-44 items-center justify-between gap-1 rounded-full border border-[var(--accent)] px-2.5 py-1 text-[var(--accent)] hover:bg-[var(--surface-2)] focus:outline-2 focus:outline-[var(--accent)]"
        >
          <span className="truncate">{picked.label}</span>
          <span aria-hidden="true">×</span>
        </button>
      </div>
    )
  }

  return (
    <>
      <label className="flex items-center gap-2 text-sm whitespace-nowrap text-[var(--text-secondary)]">
        Highlight
        {/* Native suggestions: choosing one sets the value to an option's exact label. */}
        <input
          type="search"
          list={listId}
          value={query}
          placeholder={`Find ${noun}…`}
          onChange={(event) => {
            const match = options.find((option) => option.label === event.target.value)
            if (match) pick(match.id)
            else setQuery(event.target.value)
          }}
          onKeyDown={(event) => {
            // Enter on a partial name takes the first match, same matching as the site search.
            if (event.key !== "Enter" || !query.trim()) return
            const match = options.find((option) => matchesQuery(option.label, query))
            if (match) {
              event.preventDefault()
              pick(match.id)
            }
          }}
          className="w-44 rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[var(--accent)]"
        />
      </label>
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>
    </>
  )
}

export default HighlightPicker
