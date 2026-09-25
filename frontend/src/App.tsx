// App.tsx
// Root layout: navbar, the route table for every page, and the site footer.
import { Route, Routes } from "react-router-dom"
import Navbar from "./components/Navbar"
import ComingSoonPage from "./pages/ComingSoonPage"
import HomePage from "./pages/HomePage"
import PlayerPage from "./pages/PlayerPage"
import PlayersPage from "./pages/PlayersPage"

function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-[1000px] px-6 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/teams" element={<ComingSoonPage title="Teams" />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:playerId" element={<PlayerPage />} />
          <Route path="/about" element={<ComingSoonPage title="About" />} />
        </Routes>
      </main>
      <footer className="mx-auto max-w-[1000px] px-6 pb-8 text-xs text-[var(--text-muted)]">
        Not affiliated with or endorsed by the NFL or its teams. Stats from nflverse.
      </footer>
    </div>
  )
}

export default App
