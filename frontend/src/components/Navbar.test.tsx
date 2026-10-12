// Navbar.test.tsx
// Tests for the top bar: page tabs, the active tab, and the teams + players search (shortened placeholder on phones).
import { screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { mockApi, renderWithRouter } from "../test/render"
import Navbar from "./Navbar"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Navbar", () => {
  it("links every page and marks the current one", () => {
    mockApi({})
    renderWithRouter(<Navbar />, { route: "/teams" })

    for (const tab of ["Home", "Teams", "Players", "About"]) {
      expect(screen.getByRole("link", { name: tab })).toBeInTheDocument()
    }
    expect(screen.getByRole("link", { name: "Teams" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current")
  })

  it("has a search for both teams and players", () => {
    mockApi({})
    renderWithRouter(<Navbar />)
    expect(screen.getByPlaceholderText("Search teams & players...")).toBeInTheDocument()
  })

  it("shortens the search placeholder on a phone but keeps its full name", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    mockApi({})
    renderWithRouter(<Navbar />)
    const search = screen.getByRole("combobox", { name: "Search teams & players..." })
    expect(search).toHaveAttribute("placeholder", "Search...")
  })
})
