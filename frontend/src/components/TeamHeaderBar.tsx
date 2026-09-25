// TeamHeaderBar.tsx
// Header bar for a team page, laid out like PlayerBioBar: logo, name, and record/points facts.
import { ordinal } from "../data/efficiency"
import { formatRecord, type findTeamStanding } from "../data/standings"
import type { TeamInfo } from "../data/teams"
import { teamLogoUrl } from "../lib/imageUrls"
import { TeamLogoBadge } from "./TeamLogo"

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-xs tracking-wider text-[var(--text-muted)] uppercase">{label}</dt>
      <dd className="text-sm font-medium text-[var(--text-primary)]">{value}</dd>
    </div>
  )
}

// "+15" / "−8" / "0", with a true minus sign.
function formatDifferential(value: number): string {
  if (value === 0) return "0"
  return `${value > 0 ? "+" : "−"}${Math.abs(value)}`
}

function TeamHeaderBar({ team, standing }: { team: TeamInfo; standing: ReturnType<typeof findTeamStanding> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-1)] shadow-lg shadow-black/30">
      <div className="flex flex-wrap items-center gap-6 p-6">
        <TeamLogoBadge logo={teamLogoUrl(team.team_logo_espn)} size="h-24 w-24" />

        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-3xl font-bold tracking-wide text-[var(--text-primary)] uppercase">
            {team.team_name}
          </h1>
          {standing && (
            <div className="mt-1 text-sm text-[var(--text-secondary)]">
              {formatRecord(standing.record)} · {ordinal(standing.place)} in {standing.division}
            </div>
          )}
        </div>

        {standing && (
          <dl className="min-w-[240px] divide-y divide-[var(--border)]">
            <Fact label="Record" value={formatRecord(standing.record)} />
            <Fact label="Points For" value={String(standing.record.points_for)} />
            <Fact label="Points Against" value={String(standing.record.points_against)} />
            <Fact
              label="Point Diff"
              value={formatDifferential(standing.record.points_for - standing.record.points_against)}
            />
          </dl>
        )}
      </div>
    </div>
  )
}

export default TeamHeaderBar
