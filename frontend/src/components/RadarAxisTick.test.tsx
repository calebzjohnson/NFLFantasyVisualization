// RadarAxisTick.test.tsx
// Tests for the radar axis label: long stat names split onto two centered lines (after the slash for "per" stats), short ones stay whole.
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import RadarAxisTick from "./RadarAxisTick"

function lines(label: string, verticalAnchor?: "start" | "middle" | "end") {
  const { container } = render(
    <svg>
      <RadarAxisTick x={10} y={10} verticalAnchor={verticalAnchor} payload={{ value: label }} />
    </svg>,
  )
  return [...container.querySelectorAll("tspan")]
}

describe("RadarAxisTick", () => {
  it("keeps labels under 13 characters on one line", () => {
    expect(lines("Success Rate").map((t) => t.textContent)).toEqual(["Success Rate"])
  })

  it("splits long labels at the space nearest the middle", () => {
    expect(lines("Missed Tackle %").map((t) => t.textContent)).toEqual(["Missed", "Tackle %"])
    expect(lines("Rush Yards Over Expected").map((t) => t.textContent)).toEqual(["Rush Yards", "Over Expected"])
  })

  it("keeps a per-stat's slash on the top line, with the denominator below", () => {
    expect(lines("EPA / Dropback").map((t) => t.textContent)).toEqual(["EPA /", "Dropback"])
    expect(lines("Yards / TGT Allowed").map((t) => t.textContent)).toEqual(["Yards /", "TGT Allowed"])
    expect(lines("Off. Rush EPA/Play").map((t) => t.textContent)).toEqual(["Off. Rush EPA/", "Play"])
  })

  it("centers the two lines on each other once measured", () => {
    // jsdom can't measure text, so stand in a 60px-wide label.
    const getBBox = vi.fn(() => ({ width: 60 }) as DOMRect)
    Object.defineProperty(SVGElement.prototype, "getBBox", { value: getBBox, configurable: true })
    try {
      // A right-side label: Recharts anchors its left edge at x=10.
      const { container } = render(
        <svg>
          <RadarAxisTick x={10} y={10} textAnchor="start" payload={{ value: "Missed Tackle %" }} />
        </svg>,
      )
      expect(container.querySelector("text")).toHaveAttribute("text-anchor", "middle")
      // Both lines centered on the label's midpoint, half its width right of the anchor.
      expect([...container.querySelectorAll("tspan")].map((t) => t.getAttribute("x"))).toEqual(["40", "40"])
    } finally {
      delete (SVGElement.prototype as { getBBox?: unknown }).getBBox
    }
  })

  it("leaves a long label with no space or slash whole", () => {
    expect(lines("SpecialTeamsEPA").map((t) => t.textContent)).toEqual(["SpecialTeamsEPA"])
  })

  it("grows two-line labels away from the chart", () => {
    // Bottom labels ("start") hang below their anchor; top labels ("end") sit above it.
    expect(lines("Missed Tackle %", "start")[0].getAttribute("dy")).toBe("0.71em")
    expect(lines("Missed Tackle %", "end")[0].getAttribute("dy")).toBe("-1em")
  })
})
