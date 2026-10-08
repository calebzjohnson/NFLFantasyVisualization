// HomePage.test.tsx
// Tests that the home page has its one (visually hidden) h1 and takes the bare site name as its tab title.
import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { mockApi, renderWithRouter } from "../test/render"
import HomePage from "./HomePage"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

describe("HomePage", () => {
  it("has a single h1 with the site name, and the site name as its title", () => {
    mockApi({})
    renderWithRouter(<HomePage />)

    const headings = screen.getAllByRole("heading", { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent("Plot the Pigskin")
    expect(headings[0]).toHaveClass("sr-only")
    expect(document.title).toBe("Plot the Pigskin")
  })
})
