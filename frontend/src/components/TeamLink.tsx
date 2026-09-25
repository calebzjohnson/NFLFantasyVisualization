// TeamLink.tsx
// Link to a team's page, styled like the player-name links (accent + underline on hover).
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { teamPath } from "../data/teams"

function TeamLink({ team, className = "", children }: { team: string; className?: string; children: ReactNode }) {
  return (
    <Link to={teamPath(team)} className={`hover:text-[var(--accent)] hover:underline ${className}`}>
      {children}
    </Link>
  )
}

export default TeamLink
