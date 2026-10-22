// ComparisonRadarChart.tsx
// Create page radar: an outline per pick, in its pick color, over the same 3-6 stats; each spoke is a percentile rank (further out is better), with the dashed 50th-percentile ring the player and team radars have.
// Pointing on or near the radar picks the nearest spoke by angle (see
// radarSpokeAt): a mouse gets a hover card listing every pick's value and
// percentile on it, and a tap on a touchscreen fills the details box below the
// chart instead. That spoke's points grow, so it's clear which one is described.
import { useState } from "react"
import type * as React from "react"
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"
import { ordinal } from "../data/efficiency"
import type { HoveredMark } from "../lib/chartMarks"
import { swarmCell } from "../lib/chartSummaries"
import { radarSpokeAt } from "../lib/radarSpokeAt"
import { PHONE_QUERY, TOUCH_QUERY, useMediaQuery } from "../lib/useMediaQuery"
import { useTapToOpen } from "../lib/useTapToOpen"
import { FIT_SCREEN } from "../lib/utils"
import ChartDataTable from "./ChartDataTable"
import { ChartContainer, type ChartConfig } from "./evilcharts/ui/recharts-chart"
import PickLegend from "./PickLegend"
import RadarAxisTick from "./RadarAxisTick"
import { HoverCard, TapDetails } from "./TapDetails"

// One pick's outline: its percentile and formatted value on each spoke, in the axes' order.
export interface RadarOutline {
  id: string
  name: string
  color: string
  spokes: { percentile: number | null; value: string | null }[]
}

const chartConfig = {
  reference: { label: "50th percentile" },
} satisfies ChartConfig

// Every pick's value and percentile on one spoke: the hover card's content, and the touchscreen box's.
function SpokeDetails({ label, outlines, index }: { label: string; outlines: RadarOutline[]; index: number }) {
  return (
    <div className="grid gap-1">
      <div className="font-medium text-[var(--text-primary)]">{label}</div>
      {outlines.map((outline) => {
        const spoke = outline.spokes[index]
        return (
          <div key={outline.id} className="flex items-baseline justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: outline.color }} aria-hidden="true" />
              {outline.name}
            </span>
            <span className="font-mono font-medium whitespace-nowrap tabular-nums text-[var(--text-primary)]">
              {spoke.value ?? "—"}
              {spoke.percentile !== null && (
                <span className="text-[var(--text-muted)]"> ({ordinal(Math.round(spoke.percentile))})</span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ComparisonRadarChart({
  axes,
  outlines,
  poolText,
  notes = [],
  footer,
}: {
  axes: { key: string; label: string }[]
  outlines: RadarOutline[]
  // Who the percentiles rank against, e.g. "qualifying WRs and RBs".
  poolText: string
  // Extra caption sentences, e.g. who a stat's minimum leaves out.
  notes?: string[]
  // Under the caption, e.g. a stat glossary.
  footer?: React.ReactNode
}) {
  const touchScreen = useMediaQuery(TOUCH_QUERY)
  // Recharts' default 80% leaves no room for axis labels on a phone; 70% does
  // (with RadarAxisTick wrapping the long ones), as on the player radar.
  const outerRadius = useMediaQuery(PHONE_QUERY) ? "70%" : "80%"
  const [hovered, setHovered] = useState<HoveredMark | null>(null)
  // A tap selects a spoke (its index, as a string); nothing opens.
  const tap = useTapToOpen<string>(() => {})
  const activeKey = hovered?.key ?? tap.selected
  const activeIndex = activeKey === null ? null : Number(activeKey)

  const spokeKey = (chart: Element, clientX: number, clientY: number) => {
    const index = radarSpokeAt(chart, clientX, clientY, axes.length)
    return index === null ? null : String(index)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return
    const chart = event.currentTarget
    const key = spokeKey(chart, event.clientX, event.clientY)
    const box = chart.getBoundingClientRect()
    setHovered(
      key === null
        ? null
        : { key, x: event.clientX - box.x, y: event.clientY - box.y, width: box.width, height: box.height },
    )
  }

  // One row per spoke; each pick's percentile under its id, so each Radar reads its own.
  const data = axes.map((axis, i) => ({
    key: axis.key,
    label: axis.label,
    reference: 50,
    ...Object.fromEntries(outlines.map((outline) => [outline.id, outline.spokes[i]?.percentile ?? 0])),
  }))
  const names = outlines.map((outline) => outline.name)

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <PickLegend pins={outlines} />
      </div>
      <div className="p-3">
        <div
          className="relative"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHovered(null)}
          {...(touchScreen
            ? tap.pressHandlers((x, y) => {
                const chart = document.elementFromPoint(x, y)?.closest("[data-radar]")
                return chart ? spokeKey(chart, x, y) : null
              }, tap.select)
            : {})}
          data-radar
        >
          <ChartContainer
            config={chartConfig}
            className={`aspect-[4/3] ${FIT_SCREEN}`}
            label={`Radar of ${names.join(", ")} on ${axes.length} stats, as percentile ranks among ${poolText} this season; further out is better, and the dashed ring is the 50th percentile.`}
          >
            <RadarChart outerRadius={outerRadius} data={data}>
              <PolarGrid stroke="var(--border)" radialLines={false} />
              <PolarAngleAxis dataKey="label" tick={<RadarAxisTick />} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={5} />
              {outlines.map((outline) => (
                <Radar
                  key={outline.id}
                  dataKey={outline.id}
                  stroke={outline.color}
                  strokeWidth={2}
                  fill={outline.color}
                  fillOpacity={0.12}
                  dot={(props: { cx?: number; cy?: number; payload?: unknown; key?: React.Key | null }) => (
                    <circle
                      key={props.key ?? undefined}
                      cx={props.cx}
                      cy={props.cy}
                      // The spoke being described grows; payload is that spoke's row of `data`.
                      r={activeIndex !== null && (props.payload as { key?: string })?.key === axes[activeIndex]?.key ? 5 : 3}
                      fill={outline.color}
                      stroke="var(--surface-1)"
                      strokeWidth={1.5}
                    />
                  )}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ))}
              {/* A constant-50 reference series, as on the player radar. */}
              <Radar
                dataKey="reference"
                stroke="var(--accent)"
                strokeDasharray="4 3"
                fill="none"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                legendType="none"
              />
            </RadarChart>
          </ChartContainer>
          {!touchScreen && hovered && (
            <HoverCard mark={hovered}>
              <SpokeDetails label={axes[Number(hovered.key)].label} outlines={outlines} index={Number(hovered.key)} />
            </HoverCard>
          )}
        </div>
        {touchScreen && (
          // Held at a filled box's height (a stat and five picks), so a tap doesn't shift the caption.
          <TapDetails prompt="Tap a stat to see every pick's numbers on it." className="min-h-36">
            {tap.selected !== null && axes[Number(tap.selected)] && (
              <SpokeDetails
                label={axes[Number(tap.selected)].label}
                outlines={outlines}
                index={Number(tap.selected)}
              />
            )}
          </TapDetails>
        )}
        <p className="px-3 pt-2 pb-1 text-xs text-[var(--text-muted)]">
          Each spoke is a stat, placed by percentile rank among {poolText} this season: further out is better, and
          the dashed ring marks the 50th percentile. {touchScreen ? "Tap" : "Point at"} a stat to see every pick's
          numbers on it.
          {notes.map((note) => ` ${note}`).join("")}
        </p>
        {footer}
        <ChartDataTable
          caption="Each pick's picked stats with percentile ranks"
          columns={["Stat", ...names]}
          rows={axes.map((axis, i) => [axis.label, ...outlines.map((outline) => swarmCell(outline.spokes[i]))])}
        />
      </div>
    </>
  )
}

export default ComparisonRadarChart
