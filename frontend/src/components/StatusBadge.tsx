// StatusBadge.tsx
// Availability flag beside a player's name: short glyph plus the full wording
// for screen readers, so status never rides on color alone.
import { STATUS_LABEL, STATUS_NAME, STATUS_TONE, type DepthStatus } from "../data/depthChart"

interface StatusBadgeProps {
  status: DepthStatus
  injury?: string | null
}

function StatusBadge({ status, injury }: StatusBadgeProps) {
  const name = injury ? `${STATUS_NAME[status]} - ${injury}` : STATUS_NAME[status]
  return (
    <span className={`ml-1 font-display text-xs font-bold ${STATUS_TONE[status]}`} title={name}>
      <span aria-hidden="true">{STATUS_LABEL[status]}</span>
      <span className="sr-only">{name}</span>
    </span>
  )
}

export default StatusBadge
