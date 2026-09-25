// TeamLogo.test.tsx
// Tests for the team scatter marker: clickable and keyboard-accessible only when given onSelect.
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
  it("calls onSelect on click and on Enter", () => {
    const onSelect = vi.fn()
    renderMarker(onSelect)
    const marker = screen.getByRole("button", { name: "View the Kansas City Chiefs team page" })

    fireEvent.click(marker)
    fireEvent.keyDown(marker, { key: "Enter" })
    expect(onSelect).toHaveBeenCalledTimes(2)
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
