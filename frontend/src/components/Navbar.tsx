// Navbar.tsx
// Persistent top bar: site title, page tabs, and a teams + players search.
import { Link, NavLink } from "react-router-dom"
import SearchBar from "./SearchBar"

const NAV_TABS = [
  { label: "Home", to: "/" },
  { label: "Teams", to: "/teams" },
  { label: "Players", to: "/players" },
  { label: "About", to: "/about" },
] as const

function Navbar() {
  // relative z-20: backdrop-blur puts the nav on its own layer, so without a
  // z-index the search dropdown would render underneath later page content.
  return (
    <nav className="relative z-20 border-b border-[var(--border)] bg-[var(--surface-1)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1300px] flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3">
        <Link
          to="/"
          className="font-display text-2xl font-bold tracking-wide text-[var(--text-primary)] uppercase"
        >
          Gridiron <span className="text-[var(--accent)]">Analytics</span>
        </Link>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
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
        <div className="ml-auto w-64">
          <SearchBar placeholder="Search teams & players..." scope="all" />
        </div>
      </div>
    </nav>
  )
}

export default Navbar
