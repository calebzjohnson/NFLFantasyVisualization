// Modal.test.tsx
// Tests for the overlay dialog: dismissal paths (Escape, backdrop, close
// button), what must NOT dismiss it, and its dialog semantics.
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Modal from "./Modal"

describe("Modal", () => {
  it("renders its title and children as a labelled dialog", () => {
    render(
      <Modal title="Team Efficiency" onClose={() => {}}>
        <p>chart goes here</p>
      </Modal>,
    )

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAccessibleName("Team Efficiency")
    expect(screen.getByText("chart goes here")).toBeInTheDocument()
  })

  it("closes on Escape", () => {
    const onClose = vi.fn()
    render(
      <Modal title="Leaders" onClose={onClose}>
        <p>rows</p>
      </Modal>,
    )

    fireEvent.keyDown(document, { key: "Escape" })

    expect(onClose).toHaveBeenCalledOnce()
  })

  it("closes on the close button", () => {
    const onClose = vi.fn()
    render(
      <Modal title="Leaders" onClose={onClose}>
        <p>rows</p>
      </Modal>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it("closes on a backdrop press but not on one inside the dialog", () => {
    const onClose = vi.fn()
    render(
      <Modal title="Leaders" onClose={onClose}>
        <p>rows</p>
      </Modal>,
    )

    fireEvent.mouseDown(screen.getByText("rows"))
    expect(onClose).not.toHaveBeenCalled()

    // The backdrop is the dialog's parent: pressing it directly dismisses.
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("restores focus to whatever opened it", () => {
    const opener = document.createElement("button")
    document.body.append(opener)
    opener.focus()

    const { unmount } = render(
      <Modal title="Leaders" onClose={() => {}}>
        <p>rows</p>
      </Modal>,
    )
    expect(screen.getByRole("dialog")).toHaveFocus()

    unmount()

    expect(opener).toHaveFocus()
    opener.remove()
  })
})
