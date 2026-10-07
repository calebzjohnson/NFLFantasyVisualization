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
      className="cursor-pointer rounded px-2 py-0.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
    >
      ⤢
    </button>
  )
}

export default ExpandButton
