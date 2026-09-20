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
    <nav className="border-b border-[var(--border)] bg-[var(--surface-1)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
        <span className="text-lg font-semibold text-[var(--text-primary)]">
          Gridiron Telemetry Analytics
        </span>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {NAV_TABS.map(({ label, to }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  isActive
                    ? "font-medium text-[var(--text-primary)] border-b-2 border-[var(--accent)] pb-1"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] pb-1"
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
