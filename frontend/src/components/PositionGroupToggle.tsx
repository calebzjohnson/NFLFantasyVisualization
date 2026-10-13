// PositionGroupToggle.tsx
// Pill-button group for switching between a fixed set of options (e.g. position
// groups, or a chart's axis choices). Generic over the option type so it isn't
// tied to positions specifically.
interface PositionGroupToggleProps<T extends string> {
  options: readonly T[]
  active: T
  onChange: (value: T) => void
  // Display text for an option, when it differs from the value itself (e.g. a
  // URL slug like "depth-chart" shown as "Depth Chart").
  labelFor?: (value: T) => string
  "aria-label"?: string
}

function PositionGroupToggle<T extends string>({
  options,
  active,
  onChange,
  labelFor,
  "aria-label": ariaLabel,
}: PositionGroupToggleProps<T>) {
  return (
    <div
      className="flex flex-wrap justify-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-0)] p-1"
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
          {labelFor ? labelFor(option) : option}
        </button>
      ))}
    </div>
  )
}

export default PositionGroupToggle
