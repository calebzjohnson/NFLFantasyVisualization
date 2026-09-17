import { Route, Routes } from "react-router-dom"
import Navbar from "./components/Navbar"
import ComingSoonPage from "./pages/ComingSoonPage"
import HomePage from "./pages/HomePage"
import PlayersPage from "./pages/PlayersPage"

function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/teams" element={<ComingSoonPage title="Teams" />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/about" element={<ComingSoonPage title="About" />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
