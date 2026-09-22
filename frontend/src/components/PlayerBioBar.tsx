// PlayerBioBar.tsx
// ESPN-style header bar for a player page: headshot, identity, and bio facts.
import {
  formatAge,
  formatBirthDate,
  formatDraftInfo,
  formatHeightWeight,
  type PlayerBio,
} from "../data/playerBio"
import type { TeamInfo } from "../data/teams"

interface PlayerBioBarProps {
  bio: PlayerBio
  team: TeamInfo | null
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (value === null) return null
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-xs tracking-wider text-[var(--text-muted)] uppercase">{label}</dt>
      <dd className="text-sm font-medium text-[var(--text-primary)]">{value}</dd>
    </div>
  )
}

function PlayerBioBar({ bio, team }: PlayerBioBarProps) {
  const age = formatAge(bio.birth_date)
  const birthdate = bio.birth_date
    ? `${formatBirthDate(bio.birth_date)}${age !== null ? ` (${age})` : ""}`
    : null

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-1)] shadow-lg shadow-black/30">
      <div className="flex flex-wrap items-center gap-6 p-6">
        {bio.headshot_url && (
          <img
            src={bio.headshot_url}
            alt={bio.display_name}
            className="h-24 w-24 shrink-0 rounded-full border-2 border-[var(--border)] bg-[var(--surface-2)] object-cover"
          />
        )}

        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-3xl font-bold tracking-wide text-[var(--text-primary)] uppercase">
            {bio.display_name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--text-secondary)]">
            {team && <img src={team.team_logo_espn} alt="" className="h-5 w-5 object-contain" />}
            <span>{team?.team_name ?? bio.team ?? "Free Agent"}</span>
            {bio.jersey_number && <span>· #{bio.jersey_number}</span>}
            {bio.position && <span>· {bio.position}</span>}
          </div>
        </div>

        <dl className="min-w-[240px] divide-y divide-[var(--border)]">
          <Fact label="HT/WT" value={formatHeightWeight(bio)} />
          <Fact label="Birthdate" value={birthdate} />
          <Fact label="College" value={bio.college} />
          <Fact label="Draft Info" value={formatDraftInfo(bio)} />
          <Fact label="Status" value={bio.status} />
        </dl>
      </div>
    </div>
  )
}

export default PlayerBioBar
