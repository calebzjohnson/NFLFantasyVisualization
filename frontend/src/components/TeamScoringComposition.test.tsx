// TeamScoringComposition.test.tsx
// Tests that the scoring breakdown's request encodes the team abbreviation, and that touchscreens get a tap prompt instead of the hover tooltip.
import { screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchJson } from "../lib/api"
import { mockApi, renderWithRouter } from "../test/render"
import TeamScoringComposition from "./TeamScoringComposition"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

const side = { total_points: 10, categories: [{ key: "passing", label: "Passing", points: 10 }] }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("TeamScoringComposition", () => {
  it("encodes the team abbreviation in the request path", async () => {
    mockApi({})
    renderWithRouter(<TeamScoringComposition teamAbbr="K/C?x#y" />)

    await waitFor(() => expect(fetchJson).toHaveBeenCalledWith("/teams/K%2FC%3Fx%23y/scoring"))
  })

  it("prompts a tap on a slice only on a touchscreen", async () => {
    // Separate teams: useFetch caches each path for the whole file.
    mockApi({
      "/teams/AAA/scoring": { team: "AAA", offense: side, defense: side },
      "/teams/BBB/scoring": { team: "BBB", offense: side, defense: side },
    })
    const { unmount } = renderWithRouter(<TeamScoringComposition teamAbbr="AAA" />)
    expect(await screen.findByRole("figure")).toBeInTheDocument()
    expect(screen.queryByText("Tap a slice to see its points.")).not.toBeInTheDocument()
    unmount()

    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    renderWithRouter(<TeamScoringComposition teamAbbr="BBB" />)
    expect(await screen.findByText("Tap a slice to see its points.")).toBeInTheDocument()
  })
})
