// Navbar.tsx
// Persistent top bar: site title, page tabs, and a teams + players search.
import { Link, NavLink } from "react-router-dom"
import { PHONE_QUERY, useMediaQuery } from "../lib/useMediaQuery"
import SearchBar from "./SearchBar"

const NAV_TABS = [
  { label: "Home", to: "/" },
  { label: "Teams", to: "/teams" },
  { label: "Players", to: "/players" },
  { label: "Create", to: "/create" },
  { label: "About", to: "/about" },
] as const

const SEARCH_LABEL = "Search teams & players..."

function Navbar() {
  // The search box beside the logo is too narrow on a phone for the full placeholder.
  const placeholder = useMediaQuery(PHONE_QUERY) ? "Search..." : SEARCH_LABEL
  // relative z-20: backdrop-blur puts the nav on its own layer, so without a
  // z-index the search dropdown would render underneath later page content.
  return (
    <nav className="relative z-20 border-b border-[var(--border)] bg-[var(--surface-1)]/90 backdrop-blur">
      <div className="mx-auto max-w-[1300px] px-6 py-3">
        {/* One row from 1024px up: logo, tabs, search. Narrower, the tabs move
            to their own row below so the search can sit beside the logo; the
            DOM order stays desktop's. `relative` (no padding) is what the
            search's wide dropdown stretches to, so it lines up with the logo
            and the search box. */}
        <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 lg:gap-x-8">
          <Link
            to="/"
            className="shrink-0 font-display text-2xl font-bold tracking-wide text-[var(--text-primary)] uppercase"
          >
            Plot the <span className="text-[var(--accent)]">Pigskin</span>
          </Link>
          <ul className="order-last flex w-full flex-wrap gap-x-6 gap-y-2 lg:order-none lg:w-auto">
            {NAV_TABS.map(({ label, to }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `border-b-2 pb-1 font-display text-lg font-semibold tracking-wider uppercase transition-colors ${
                      isActive
                        ? "border-[var(--accent)] text-[var(--text-primary)]"
                        : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="ml-auto max-w-64 min-w-0 flex-1 lg:w-64 lg:flex-none">
            <SearchBar placeholder={placeholder} label={SEARCH_LABEL} scope="all" wideDropdown />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
