import Navbar from "./components/Navbar"
import StatLeaders from "./components/StatLeaders"

function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <StatLeaders />
      </main>
    </div>
  )
}

export default App
