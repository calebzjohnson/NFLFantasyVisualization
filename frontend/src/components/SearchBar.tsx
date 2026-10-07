// SearchBar.tsx
// Search box for players, teams, or both (`scope`): fetches the lists once,
// filters them client-side as the user types (see data/search.ts), and shows
// matches in an ARIA combobox listbox linking to each page - grouped Teams,
// then Players, when searching both. Arrow keys move through results, Enter
// opens one, Escape closes the list.
import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
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

const DROPDOWN_CLASS =
  "absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-1)] shadow-lg"

interface SearchOption {
  key: string
  to: string
  state?: { playerName: string | null }
  content: ReactNode
}

interface SearchBarProps {
  placeholder: string
  scope: SearchScope
}

function SearchBar({ placeholder, scope }: SearchBarProps) {
  const navigate = useNavigate()
  const players = useFetch<SearchPlayer[]>(scope === "teams" ? null : PLAYERS_PATH)
  const teams = useFetch<TeamInfo[]>(scope === "players" ? null : "/teams")
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const optionId = (index: number) => `${listboxId}-option-${index}`

  const matches = searchResults(query, scope, players.data, teams.data)
  const teamOptions: SearchOption[] = matches.teams.map((team) => ({
    key: `team-${team.team_abbr}`,
    to: teamPath(team.team_abbr),
    content: (
      <>
        <span className="flex items-center gap-2 font-medium">
          <TeamLogoBadge logo={teamLogoUrl(team.team_logo_espn)} size="h-5 w-5" />
          {team.team_name}
        </span>
        <span className="text-xs text-[var(--text-muted)]">{team.team_abbr}</span>
      </>
    ),
  }))
  const playerOptions: SearchOption[] = matches.players.map((player) => ({
    key: `player-${player.player_id}`,
    to: `/players/${player.player_id}`,
    state: { playerName: player.player_display_name },
    content: (
      <>
        <span className="font-medium">{player.player_display_name}</span>
        <span className="text-xs text-[var(--text-muted)]">
          {player.position} · {player.recent_team}
        </span>
      </>
    ),
  }))
  // Display order, so arrow keys and Enter can index one list across both groups.
  const options = [...teamOptions, ...playerOptions]

  const showDropdown = open && query.trim().length > 0
  const listboxOpen = showDropdown && options.length > 0

  function close() {
    setOpen(false)
    setActive(-1)
  }

  function select(option: SearchOption) {
    setQuery("")
    close()
    navigate(option.to, { state: option.state })
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault() // keep the caret from jumping to the start/end
      if (!listboxOpen) {
        setOpen(true)
        setActive(event.key === "ArrowDown" ? 0 : options.length - 1)
        return
      }
      const step = event.key === "ArrowDown" ? 1 : -1
      setActive((current) => (current + step + options.length) % options.length)
    } else if (event.key === "Enter" && listboxOpen) {
      event.preventDefault()
      select(options[active >= 0 ? active : 0])
    }
  }

  function renderOption(option: SearchOption, index: number) {
    return (
      <Link
        key={option.key}
        id={optionId(index)}
        role="option"
        aria-selected={index === active}
        to={option.to}
        state={option.state}
        // Keep focus in the input, so its blur doesn't close the list before the click lands.
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActive(index)}
        onClick={() => {
          setQuery("")
          close()
        }}
        className={`flex items-center justify-between gap-2 px-3 py-2 text-sm text-[var(--text-primary)] ${
          index === active ? "bg-[var(--surface-2)]" : ""
        }`}
      >
        {option.content}
      </Link>
    )
  }

  function renderGroup(label: string, groupOptions: SearchOption[], offset: number) {
    if (groupOptions.length === 0) return null
    const labelId = `${listboxId}-${label}`
    return (
      <div role="group" aria-labelledby={labelId}>
        <div
          id={labelId}
          className="bg-[var(--surface-2)] px-3 py-1 text-[10px] font-medium tracking-wider text-[var(--text-muted)] uppercase"
        >
          {label}
        </div>
        {groupOptions.map((option, i) => renderOption(option, offset + i))}
      </div>
    )
  }

  return (
    <div
      className="relative w-full max-w-sm"
      onBlur={(event) => {
        // Tabbing from the input into a result keeps the list open; leaving the component closes it.
        if (!event.currentTarget.contains(event.relatedTarget)) close()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && showDropdown) {
          event.preventDefault() // close the list without also clearing the query
          // Refocus first: the input's onFocus reopens the list, and close() must win.
          inputRef.current?.focus()
          close()
        }
      }}
    >
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        placeholder={placeholder}
        aria-label={placeholder}
        aria-autocomplete="list"
        aria-expanded={listboxOpen}
        aria-controls={listboxOpen ? listboxId : undefined}
        aria-activedescendant={listboxOpen && active >= 0 ? optionId(active) : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[var(--accent)]"
      />
      {showDropdown && options.length === 0 && (
        <p role="status" className={`${DROPDOWN_CLASS} px-3 py-2 text-sm text-[var(--text-muted)]`}>
          {NO_RESULTS[scope]}
        </p>
      )}
      {listboxOpen && (
        <div id={listboxId} role="listbox" aria-label={placeholder} className={DROPDOWN_CLASS}>
          {scope === "all" ? (
            <>
              {renderGroup("Teams", teamOptions, 0)}
              {renderGroup("Players", playerOptions, teamOptions.length)}
            </>
          ) : (
            options.map(renderOption)
          )}
        </div>
      )}
    </div>
  )
}

export default SearchBar
