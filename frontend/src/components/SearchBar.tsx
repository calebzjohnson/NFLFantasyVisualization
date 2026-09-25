// SearchBar.tsx
// Search box for players, teams, or both (`scope`): fetches the lists once,
// filters them client-side as the user types (see data/search.ts), and shows
// matches in a dropdown linking to each page - grouped Teams, then Players,
// when searching both.
import { type ReactNode, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { searchResults, type SearchPlayer, type SearchScope } from "../data/search"
import { teamPath, type TeamInfo } from "../data/teams"
import { teamLogoUrl } from "../lib/imageUrls"
import { useFetch } from "../lib/useFetch"
import { TeamLogoBadge } from "./TeamLogo"

const PLAYERS_PATH = "/players?fields=player_id,player_display_name,recent_team,position"

const NO_RESULTS: Record<SearchScope, string> = {
  players: "No players found",
  teams: "No teams found",
  all: "No teams or players found",
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <li className="bg-[var(--surface-2)] px-3 py-1 text-[10px] font-medium tracking-wider text-[var(--text-muted)] uppercase">
      {children}
    </li>
  )
}

interface SearchBarProps {
  placeholder: string
  scope: SearchScope
}

function SearchBar({ placeholder, scope }: SearchBarProps) {
  const players = useFetch<SearchPlayer[]>(scope === "teams" ? null : PLAYERS_PATH)
  const teams = useFetch<TeamInfo[]>(scope === "players" ? null : "/teams")
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const matches = searchResults(query, scope, players.data, teams.data)
  const grouped = scope === "all"

  // Shared by every result link: keep the dropdown alive through the click, then reset.
  const resultLinkProps = {
    onMouseDown: () => clearTimeout(blurTimeout.current),
    onClick: () => {
      setQuery("")
      setOpen(false)
    },
    className: "flex items-center justify-between gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-2)]",
  }

  return (
    <div className="relative w-full max-w-sm">
      <input
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay closing so a click on a result registers before the dropdown unmounts.
          blurTimeout.current = setTimeout(() => setOpen(false), 150)
        }}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[var(--accent)]"
      />
      {open && query.trim().length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-1)] shadow-lg">
          {matches.teams.length === 0 && matches.players.length === 0 && (
            <li className="px-3 py-2 text-sm text-[var(--text-muted)]">{NO_RESULTS[scope]}</li>
          )}
          {grouped && matches.teams.length > 0 && <GroupLabel>Teams</GroupLabel>}
          {matches.teams.map((team) => (
            <li key={team.team_abbr}>
              <Link to={teamPath(team.team_abbr)} {...resultLinkProps}>
                <span className="flex items-center gap-2 font-medium">
                  <TeamLogoBadge logo={teamLogoUrl(team.team_logo_espn)} size="h-5 w-5" />
                  {team.team_name}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{team.team_abbr}</span>
              </Link>
            </li>
          ))}
          {grouped && matches.players.length > 0 && <GroupLabel>Players</GroupLabel>}
          {matches.players.map((player) => (
            <li key={player.player_id}>
              <Link
                to={`/players/${player.player_id}`}
                state={{ playerName: player.player_display_name }}
                {...resultLinkProps}
              >
                <span className="font-medium">{player.player_display_name}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {player.position} · {player.recent_team}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SearchBar
