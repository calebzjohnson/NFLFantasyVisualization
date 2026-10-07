// AboutPage.test.tsx
// Tests for the about page: developer links, data credit, freshness line, release notes, stack, and feedback email.
import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useFetch } from "../lib/useFetch"
import { renderWithRouter } from "../test/render"
import AboutPage from "./AboutPage"

// Mocked directly (not via mockApi): useFetch caches per path for the whole
// file, and the freshness tests need different answers for the same path.
vi.mock("../lib/useFetch", () => ({ useFetch: vi.fn() }))

function mockLatestWeek(data: unknown) {
  vi.mocked(useFetch).mockReturnValue({ data, loading: false, error: null })
}

describe("AboutPage", () => {
  it("links each developer's GitHub in a new tab", () => {
    mockLatestWeek(null)
    renderWithRouter(<AboutPage />)
    for (const github of ["calebzjohnson", "willtaggard"]) {
      const link = screen.getByRole("link", { name: `@${github} on GitHub` })
      expect(link).toHaveAttribute("href", `https://github.com/${github}`)
      expect(link).toHaveAttribute("rel", "noopener noreferrer")
    }
  })

  it("credits nflverse and its license", () => {
    mockLatestWeek(null)
    renderWithRouter(<AboutPage />)
    expect(screen.getByRole("link", { name: "nflverse" })).toHaveAttribute("href", "https://github.com/nflverse")
    expect(screen.getByRole("link", { name: "CC BY 4.0 license" })).toBeInTheDocument()
  })

  it("shows the v1 release notes and the tech stack", () => {
    mockLatestWeek(null)
    renderWithRouter(<AboutPage />)
    expect(screen.getByText("v1")).toBeInTheDocument()
    for (const tool of ["React", "Recharts", "FastAPI"]) {
      expect(screen.getByRole("link", { name: tool })).toBeInTheDocument()
    }
  })

  it("links a feedback email", () => {
    mockLatestWeek(null)
    renderWithRouter(<AboutPage />)
    expect(screen.getByRole("link", { name: "feedback@example.com" })).toHaveAttribute(
      "href",
      "mailto:feedback@example.com",
    )
  })

  it("says which regular-season week the stats run through", () => {
    mockLatestWeek({ season: 2026, week: 5, season_type: "REG" })
    renderWithRouter(<AboutPage />)
    expect(screen.getByText("Stats through Week 5 of the 2026 season.")).toBeInTheDocument()
  })

  it("sets a refresh expectation without promising an exact lag", () => {
    mockLatestWeek(null)
    renderWithRouter(<AboutPage />)
    expect(
      screen.getByText("Data refreshes about once a day, so new games usually show up within a day or two."),
    ).toBeInTheDocument()
  })

  it("says postseason instead of a week number in the playoffs", () => {
    mockLatestWeek({ season: 2025, week: 20, season_type: "POST" })
    renderWithRouter(<AboutPage />)
    expect(screen.getByText("Stats through the 2025 postseason.")).toBeInTheDocument()
  })
})
