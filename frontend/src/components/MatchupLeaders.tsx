// MatchupLeaders.tsx
// Who led the game in each category, the two teams' best facing each other
// across the category name: headshot and number on the outside, name,
// position and what the number was made of beneath. A category nobody
// figured in is absent from the payload rather than shown as a 0-yard
// leader, and a side with nobody in it shows a dash.
import { Link } from "react-router-dom"
import type { Leader, LeaderRow } from "../data/matchups"
import { logoByTeam, type TeamInfo } from "../data/teams"
import Panel from "./Panel"
import PlayerAvatar from "./PlayerAvatar"
import { TeamLogoBadge } from "./TeamLogo"

function Who({ leader, color, home }: { leader: Leader | null; color: string; home: boolean }) {
  if (!leader) {
    return (
      <div className={`flex-1 text-sm text-[var(--text-muted)] ${home ? "text-right" : ""}`}>—</div>
    )
  }
  const name = leader.name ?? "Unknown"
  const value = leader.value % 1 === 0 ? leader.value : leader.value.toFixed(1)

  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-1 ${home ? "items-end" : ""}`}>
      <div className={`flex items-center gap-2.5 ${home ? "flex-row-reverse" : ""}`}>
        <PlayerAvatar name={name} headshot={leader.headshot_url ?? null} color={color} size="h-12 w-12" imageSize={96} />
        <span className="font-display text-3xl tabular-nums text-[var(--text-primary)]">
          {value}
        </span>
      </div>
      <div className={`flex min-w-0 max-w-full items-baseline gap-1.5 ${home ? "flex-row-reverse" : ""}`}>
        {leader.player_id ? (
          <Link
            to={`/players/${leader.player_id}`}
            className="min-w-0 truncate font-display text-base text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span className="min-w-0 truncate font-display text-base text-[var(--text-primary)]">
            {name}
          </span>
        )}
        {leader.position && (
          <span className="shrink-0 text-sm text-[var(--text-muted)]">{leader.position}</span>
        )}
      </div>
    </div>
  )
}

function MatchupLeaders({
  rows,
  away,
  home,
  teams,
  title = "Game Leaders",
  caption,
  awaitingPressures = false,
}: {
  rows: LeaderRow[]
  away: string
  home: string
  teams: TeamInfo[]
  title?: string
  caption?: string
  awaitingPressures?: boolean
}) {
  if (rows.length === 0) return null
  const away_team = away
  const home_team = home
  const logos = logoByTeam(teams)
  const colorOf = (abbr: string) =>
    teams.find((team) => team.team_abbr === abbr)?.team_color ?? "#2a78d6"

  return (
    <Panel title={title}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
        {[away_team, home_team].map((team, index) => (
          <span
            key={team}
            className={`flex items-center gap-2 font-display text-lg font-bold tracking-wide ${
              index === 1 ? "flex-row-reverse" : ""
            }`}
          >
            {logos.has(team) && <TeamLogoBadge logo={logos.get(team) as string} size="h-7 w-7" />}
            {team}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0"
        >
          <Who leader={row.leaders[0] ?? null} color={colorOf(away_team)} home={false} />
          <span className="w-20 shrink-0 self-center text-center font-display text-sm font-bold tracking-wide text-[var(--text-secondary)] sm:w-28">
            {row.label}
          </span>
          <Who leader={row.leaders[1] ?? null} color={colorOf(home_team)} home />
        </div>
      ))}
      {(caption || awaitingPressures) && (
        <p className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-muted)]">
          {caption}
          {caption && awaitingPressures ? " " : ""}
          {awaitingPressures &&
            "Pressures appear once Pro Football Reference publishes its charting for this game."}
        </p>
      )}
    </Panel>
  )
}

export default MatchupLeaders
