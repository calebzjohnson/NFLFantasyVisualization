// PositionGroupToggle.tsx
// Pill-button group for switching between a fixed set of options (e.g. position
// groups, or a chart's axis choices). Generic over the option type so it isn't
// tied to positions specifically.
interface PositionGroupToggleProps<T extends string> {
  options: readonly T[]
  active: T
  onChange: (value: T) => void
  "aria-label"?: string
}

function PositionGroupToggle<T extends string>({
  options,
  active,
  onChange,
  "aria-label": ariaLabel,
}: PositionGroupToggleProps<T>) {
  return (
    <div
      className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-0)] p-1"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={option === active}
          className={`rounded px-3 py-0.5 font-display text-base tracking-wider uppercase transition-colors ${
            option === active
              ? "bg-[var(--accent)] font-bold text-[var(--surface-0)]"
              : "font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export default PositionGroupToggle
