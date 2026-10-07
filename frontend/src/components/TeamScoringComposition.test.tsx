// TeamScoringComposition.test.tsx
// Tests that the scoring breakdown's request encodes the team abbreviation.
import { waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { fetchJson } from "../lib/api"
import { mockApi, renderWithRouter } from "../test/render"
import TeamScoringComposition from "./TeamScoringComposition"

vi.mock("../lib/api", () => ({ fetchJson: vi.fn() }))

describe("TeamScoringComposition", () => {
  it("encodes the team abbreviation in the request path", async () => {
    mockApi({})
    renderWithRouter(<TeamScoringComposition teamAbbr="K/C?x#y" />)

    await waitFor(() => expect(fetchJson).toHaveBeenCalledWith("/teams/K%2FC%3Fx%23y/scoring"))
  })
})
