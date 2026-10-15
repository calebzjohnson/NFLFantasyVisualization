// TeamLogo.test.tsx
// Tests for the team scatter marker: keyboard-accessible only when given onSelect (clicks are the chart's), with an optional name override.
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TeamLogoMarker } from "./TeamLogo"

const payload = { logo: "kc.png", name: "Kansas City Chiefs" }

function renderMarker(onSelect?: () => void) {
  render(
    <svg>
      <TeamLogoMarker cx={10} cy={10} payload={payload} onSelect={onSelect} />
    </svg>,
  )
}

describe("TeamLogoMarker", () => {
  it("calls onSelect on Enter and Space, leaving clicks to the chart", () => {
    const onSelect = vi.fn()
    renderMarker(onSelect)
    const marker = screen.getByRole("button", { name: "View the Kansas City Chiefs team page" })

    // The chart resolves clicks to the nearest mark (see chartMarks), so the marker ignores them.
    fireEvent.click(marker)
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.keyDown(marker, { key: "Enter" })
    // Like a native button: Space activates and doesn't scroll the page.
    expect(fireEvent.keyDown(marker, { key: " " })).toBe(false)
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it("takes a different screen-reader name when activating it highlights instead", () => {
    render(
      <svg>
        <TeamLogoMarker cx={10} cy={10} payload={payload} onSelect={() => {}} label="Highlight the Kansas City Chiefs" />
      </svg>,
    )
    expect(screen.getByRole("button", { name: "Highlight the Kansas City Chiefs" })).toBeInTheDocument()
  })

  it("isn't a button without onSelect", () => {
    renderMarker()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("renders nothing until recharts gives it a position", () => {
    const { container } = render(
      <svg>
        <TeamLogoMarker payload={payload} />
      </svg>,
    )
    expect(container.querySelector("circle")).toBeNull()
  })
})
