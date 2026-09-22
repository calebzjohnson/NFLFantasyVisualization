// SearchBar.tsx
// Player search: fetches the full player list once, filters it client-side
// as the user types, and shows matches in a dropdown linking to each
// player's page.
import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useFetch } from "../lib/useFetch"

// nflverse's player-stats table includes a stray aggregate row with every
// field null - fields are optional here so the filter below can skip it.
interface SearchPlayer {
  player_id: string | null
  player_display_name: string | null
  recent_team: string | null
  position: string | null
}

const PLAYERS_PATH = "/players?fields=player_id,player_display_name,recent_team,position"
const MAX_RESULTS = 8

// Whole-string substring matching breaks on "Josh Farmer" vs "Joshua Farmer" -
// the extra letters in "Joshua" push the second word out of alignment. Instead,
// each typed word just needs to prefix-match some word in the name, so first
// or last name (or a shortened first name) all still find the player.
function matchesQuery(name: string, query: string): boolean {
  const nameWords = name.toLowerCase().split(/\s+/)
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean)
  return queryWords.every((queryWord) => nameWords.some((nameWord) => nameWord.startsWith(queryWord)))
}

interface SearchBarProps {
  placeholder: string
}

function SearchBar({ placeholder }: SearchBarProps) {
  const { data } = useFetch<SearchPlayer[]>(PLAYERS_PATH)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const trimmed = query.trim()
  const matches =
    trimmed.length === 0
      ? []
      : (data?.filter((player) => player.player_display_name && matchesQuery(player.player_display_name, trimmed)) ?? []).slice(
          0,
          MAX_RESULTS,
        )

  return (
    <div className="relative w-full max-w-sm">
      <input
        type="search"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay closing so a click on a result registers before the dropdown unmounts.
          blurTimeout.current = setTimeout(() => setOpen(false), 150)
        }}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[var(--accent)]"
      />
      {open && trimmed.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-1)] shadow-lg">
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-[var(--text-muted)]">No players found</li>}
          {matches.map((player) => (
            <li key={player.player_id}>
              <Link
                to={`/players/${player.player_id}`}
                state={{ playerName: player.player_display_name }}
                onMouseDown={() => clearTimeout(blurTimeout.current)}
                onClick={() => {
                  setQuery("")
                  setOpen(false)
                }}
                className="flex items-center justify-between px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
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
