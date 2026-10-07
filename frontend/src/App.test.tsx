// App.test.tsx
// Tests the skip link: first thing Tab reaches, and it moves focus to the main content.
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import App from "./App"
import { mockApi } from "./test/render"

vi.mock("./lib/api", () => ({ fetchJson: vi.fn() }))

describe("App skip link", () => {
  it("is the first focusable element and moves focus to main", () => {
    mockApi({})
    const { container } = render(
      <MemoryRouter initialEntries={["/about"]}>
        <App />
      </MemoryRouter>,
    )

    const skip = screen.getByRole("link", { name: "Skip to main content" })
    const firstFocusable = container.querySelector("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])")
    expect(firstFocusable).toBe(skip)

    fireEvent.click(skip)
    expect(screen.getByRole("main")).toHaveFocus()
    expect(screen.getByRole("main")).toHaveAttribute("id", "main")
  })
})
