// PlayerAvatar.test.tsx
// Covers PlayerAvatar: the headshot keeps its stated size, and initials stand in without a photo.
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import PlayerAvatar from "./PlayerAvatar"

describe("PlayerAvatar", () => {
  it("opts the headshot out of preflight's max-width so a shrinking row can't squash it into an oval", () => {
    const { container } = render(<PlayerAvatar name="Ja'Marr Chase" headshot="https://x/y.png" color="#FB4F14" size="h-8 w-8" />)
    expect(container.querySelector("img")).toHaveClass("h-8", "w-8", "max-w-none", "rounded-full")
  })

  it("shows initials when there's no headshot", () => {
    render(<PlayerAvatar name="Ja'Marr Chase" headshot={null} color="#FB4F14" size="h-8 w-8" />)
    expect(screen.getByText("JC")).toHaveClass("rounded-full")
  })
})
