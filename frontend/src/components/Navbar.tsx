const NAV_TABS = ["Home", "Players", "Teams", "Stats"] as const

const ACTIVE_TAB: (typeof NAV_TABS)[number] = "Home"

function Navbar() {
  return (
    <nav className="border-b border-[var(--border)] bg-[var(--surface-1)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
        <span className="text-lg font-semibold text-[var(--text-primary)]">
          NFL Fantasy Visualization
        </span>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {NAV_TABS.map((tab) => {
            const isActive = tab === ACTIVE_TAB
            return (
              <li key={tab}>
                <a
                  href="#"
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "font-medium text-[var(--text-primary)] border-b-2 border-[var(--accent)] pb-1"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] pb-1"
                  }
                  onClick={(e) => e.preventDefault()}
                >
                  {tab}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

export default Navbar
