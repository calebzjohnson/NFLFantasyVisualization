// HighlightPicker.test.tsx
// Tests for the chart highlight search: picking by suggestion or Enter, and clearing the pick's chip.
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import HighlightPicker, { type HighlightOption } from "./HighlightPicker"

const OPTIONS: HighlightOption[] = [
  { id: "a", label: "Josh Allen · BUF" },
  { id: "b", label: "Joshua Palmer · BUF" },
  { id: "c", label: "Patrick Mahomes · KC" },
]

function picker(picked: HighlightOption | null = null) {
  const onPick = vi.fn()
  const onClear = vi.fn()
  render(<HighlightPicker noun="players" options={OPTIONS} picked={picked} onPick={onPick} onClear={onClear} />)
  return { onPick, onClear, input: screen.getByLabelText("Highlight") }
}

describe("HighlightPicker", () => {
  it("suggests every option except the current pick", () => {
    const { input } = picker(OPTIONS[0])
    const list = document.getElementById(input.getAttribute("list")!)!
    expect([...list.querySelectorAll("option")].map((option) => option.value)).toEqual([
      "Joshua Palmer · BUF",
      "Patrick Mahomes · KC",
    ])
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

  it("stays usable with a pick, so a new pick can replace it", () => {
    const { input, onPick } = picker(OPTIONS[2])
    expect(input).toBeEnabled()
    fireEvent.change(input, { target: { value: "Josh Allen · BUF" } })
    expect(onPick).toHaveBeenCalledWith("a")
  })

  it("shows the pick as a chip that clears it", () => {
    const { onClear } = picker(OPTIONS[2])
    fireEvent.click(screen.getByRole("button", { name: "Stop highlighting Patrick Mahomes · KC" }))
    expect(onClear).toHaveBeenCalled()
  })
})
