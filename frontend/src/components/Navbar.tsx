// Navbar.tsx
// Persistent top bar: site title and page tabs.
import { NavLink } from "react-router-dom"

const NAV_TABS = [
  { label: "Home", to: "/" },
  { label: "Teams", to: "/teams" },
  { label: "Players", to: "/players" },
  { label: "About", to: "/about" },
] as const

function Navbar() {
  return (
    <nav className="border-b border-[var(--border)] bg-[var(--surface-1)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
        <span className="font-display text-2xl font-bold tracking-wide text-[var(--text-primary)] uppercase">
          Gridiron <span className="text-[var(--accent)]">Telemetry</span> Analytics
        </span>
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
      </div>
    </nav>
  )
}

export default Navbar
