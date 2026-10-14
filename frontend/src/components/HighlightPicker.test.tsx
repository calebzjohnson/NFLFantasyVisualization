// HighlightPicker.test.tsx
// Tests for the chart highlight search: picking by suggestion or Enter, and the chip that replaces it to clear the pick.
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import HighlightPicker, { type HighlightOption } from "./HighlightPicker"

const OPTIONS: HighlightOption[] = [
  { id: "a", label: "Josh Allen · BUF" },
  { id: "b", label: "Joshua Palmer · BUF" },
  { id: "c", label: "Patrick Mahomes · KC" },
]

function picker() {
  const onPick = vi.fn()
  render(<HighlightPicker noun="players" options={OPTIONS} picked={null} onPick={onPick} onClear={vi.fn()} />)
  return { onPick, input: screen.getByLabelText("Highlight") }
}

describe("HighlightPicker", () => {
  it("suggests every option", () => {
    const { input } = picker()
    const list = document.getElementById(input.getAttribute("list")!)!
    expect([...list.querySelectorAll("option")].map((option) => option.value)).toEqual(OPTIONS.map((o) => o.label))
  })

  it("picks an option when a suggestion is chosen, then clears the box", () => {
    const { input, onPick } = picker()
    fireEvent.change(input, { target: { value: "Patrick Mahomes · KC" } })
    expect(onPick).toHaveBeenCalledWith("c")
    expect(input).toHaveValue("")
  })

  it("keeps typing without picking until the text is a full option", () => {
    const { input, onPick } = picker()
    fireEvent.change(input, { target: { value: "Pat" } })
    expect(onPick).not.toHaveBeenCalled()
    expect(input).toHaveValue("Pat")
  })

  it("picks the first word-prefix match on Enter", () => {
    const { input, onPick } = picker()
    fireEvent.change(input, { target: { value: "josh pal" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onPick).toHaveBeenCalledWith("b")
  })

  it("swaps the search box for a chip that clears the pick", () => {
    const onClear = vi.fn()
    render(<HighlightPicker noun="players" options={OPTIONS} picked={OPTIONS[2]} onPick={vi.fn()} onClear={onClear} />)
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Stop highlighting Patrick Mahomes · KC" }))
    expect(onClear).toHaveBeenCalled()
  })
})
