// PlayersPage.test.tsx
// Tests for the players page's position toggle: read from and written to the URL so Back returns to it.
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import PlayersPage from "./PlayersPage"

// The panels fetch data; these tests only care which position they're handed.
vi.mock("../components/StatLeadersPanel", () => ({
  default: ({ position }: { position: string }) => <p>Leaders: {position}</p>,
}))
vi.mock("../components/PlayerComparisonScatter", () => ({ default: () => null }))
vi.mock("../components/TrendingPlayersChart", () => ({ default: () => null }))
vi.mock("../components/SearchBar", () => ({ default: () => null }))

// Stand-in player page with a working Back button, like the browser's.
function FakePlayerPage() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>Back</button>
}

function renderAt(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/players/:playerId" element={<FakePlayerPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const pressed = () => screen.getAllByRole("button").find((b) => b.getAttribute("aria-pressed") === "true")

describe("PlayersPage", () => {
  it("defaults to QB", () => {
    renderAt("/players")
    expect(pressed()).toHaveTextContent("QB")
    expect(screen.getByText("Leaders: QB")).toBeInTheDocument()
  })

  it("opens on the position in the URL", () => {
    renderAt("/players?position=WR")
    expect(pressed()).toHaveTextContent("WR")
    expect(screen.getByText("Leaders: WR")).toBeInTheDocument()
  })

  it("accepts a lowercase position in the URL", () => {
    renderAt("/players?position=wr")
    expect(pressed()).toHaveTextContent("WR")
  })

  it("falls back to QB for an unknown position", () => {
    renderAt("/players?position=XYZ")
    expect(pressed()).toHaveTextContent("QB")
  })

  it("returns to the chosen position after leaving and pressing Back", () => {
    function LeaveButton() {
      const navigate = useNavigate()
      return <button onClick={() => navigate("/players/P1")}>Open player</button>
    }
    render(
      <MemoryRouter initialEntries={["/players"]}>
        <Routes>
          <Route
            path="/players"
            element={
              <>
                <PlayersPage />
                <LeaveButton />
              </>
            }
          />
          <Route path="/players/:playerId" element={<FakePlayerPage />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole("button", { name: "TE" }))
    fireEvent.click(screen.getByRole("button", { name: "Open player" }))
    fireEvent.click(screen.getByRole("button", { name: "Back" }))

    expect(pressed()).toHaveTextContent("TE")
    expect(screen.getByText("Leaders: TE")).toBeInTheDocument()
  })
})
