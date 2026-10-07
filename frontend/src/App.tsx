// App.tsx
// Root layout: skip link, navbar, the route table for every page, and the site footer.
import type * as React from "react"
import { Route, Routes } from "react-router-dom"
import Navbar from "./components/Navbar"
import AboutPage from "./pages/AboutPage"
import HomePage from "./pages/HomePage"
import PlayerPage from "./pages/PlayerPage"
import PlayersPage from "./pages/PlayersPage"
import TeamPage from "./pages/TeamPage"
import TeamsPage from "./pages/TeamsPage"

// Moves focus (not just scroll) to the page content, so the next Tab
// continues from there instead of back through the navbar.
function skipToMain(event: React.MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
  document.getElementById("main")?.focus()
}

function App() {
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        onClick={skipToMain}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-[var(--surface-1)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--accent)] focus:shadow-lg focus:outline-2 focus:outline-[var(--accent)]"
      >
        Skip to main content
      </a>
      <Navbar />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1000px] px-6 py-8 focus:outline-none">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:teamAbbr" element={<TeamPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:playerId" element={<PlayerPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
      <footer className="mx-auto max-w-[1000px] px-6 pb-8 text-xs text-[var(--text-muted)]">
        Not affiliated with or endorsed by the NFL or its teams. Stats from nflverse.
      </footer>
    </div>
  )
}

export default App
