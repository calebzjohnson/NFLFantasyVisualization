// ExpandButton.tsx
// Panel-header control that opens a panel's fuller view in a Modal. Styled to
// sit beside the other header actions (e.g. PositionGroupToggle).
function ExpandButton({ label, expanded, onClick }: {
  label: string
  expanded: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[var(--border)] text-xl leading-none text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-1)] hover:text-[var(--accent)]"
    >
      ⤢
    </button>
  )
}

export default ExpandButton
