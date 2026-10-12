// RadarAxisTick.tsx
// Radar axis label that splits long stat names onto two centered lines, so they fit beside the chart on a phone.
import { useLayoutEffect, useRef, useState } from "react"

// At the radars' 11px font, labels of 13+ characters ("CMP % Allowed",
// "Yards / TGT Allowed") overflow a 360px-wide phone's chart; shorter ones fit.
// Known exception, accepted: on 360px phones the team radar's "Off. Rush EPA/"
// and "Def. Rush EPA/" top lines still clip 2-4px (393px+ phones fit).
const WRAP_AT = 13

// A "per" label breaks after its slash, so the slash stays with the numerator
// ("EPA /" over "Dropback"). Anything else breaks at the space nearest the
// middle, so the two lines are close in length.
function splitLabel(label: string): string[] {
  if (label.length < WRAP_AT) return [label]
  const slash = label.indexOf("/")
  if (slash !== -1) return [label.slice(0, slash + 1).trimEnd(), label.slice(slash + 1).trimStart()]
  let best = -1
  for (let i = label.indexOf(" "); i !== -1; i = label.indexOf(" ", i + 1)) {
    if (best === -1 || Math.abs(i - label.length / 2) < Math.abs(best - label.length / 2)) best = i
  }
  return best === -1 ? [label] : [label.slice(0, best), label.slice(best + 1)]
}

// The props Recharts passes a custom PolarAngleAxis tick (a subset).
interface RadarAxisTickProps {
  x?: number
  y?: number
  textAnchor?: "start" | "middle" | "end" | "inherit"
  // Recharts anchors top-sector labels by their last line ("end") and
  // bottom-sector ones by their first ("start"), so text grows away from the chart.
  verticalAnchor?: "start" | "middle" | "end"
  payload?: { value: string }
}

function RadarAxisTick({ x = 0, y = 0, textAnchor, verticalAnchor = "middle", payload }: RadarAxisTickProps) {
  const label = String(payload?.value ?? "")
  const lines = splitLabel(label)
  const ref = useRef<SVGTextElement>(null)
  // Width of the widest line. Measured before paint, so the label never shows uncentered.
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    // getBBox is missing in jsdom; the label then just keeps Recharts' alignment.
    if (lines.length > 1) setWidth(ref.current?.getBBox?.().width ?? 0)
  }, [label, lines.length])

  // SVG can't center lines on each other within a left- or right-aligned
  // block, so center every line on the block's midpoint instead: half the
  // widest line's width from Recharts' anchor point.
  const shift = textAnchor === "start" ? width / 2 : textAnchor === "end" ? -width / 2 : 0
  const centered = lines.length > 1 && (width > 0 || textAnchor === "middle")
  const lineX = centered ? x + shift : x

  // Same offsets Recharts' own <Text> uses: 1em line height, 0.71em cap height.
  const extra = lines.length - 1
  const firstDy = verticalAnchor === "start" ? 0.71 : verticalAnchor === "end" ? -extra : 0.355 - extra / 2
  return (
    <text
      ref={ref}
      x={lineX}
      y={y}
      textAnchor={centered ? "middle" : textAnchor}
      fill="var(--text-secondary)"
      fontSize={11}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={lineX} dy={`${i === 0 ? firstDy : 1}em`}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

export default RadarAxisTick
