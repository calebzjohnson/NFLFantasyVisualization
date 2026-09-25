// TeamLogo.tsx
// Team logo on a light round badge: an HTML version (tables, tooltips) and an SVG chart marker.

// Each logo sits on a fixed light badge (not a theme token) - NFL logos are
// drawn assuming a light background, so the badge has to stay light no matter
// what the page theme is.
export const BADGE_FILL = "#f2f2f0"
const MARKER_RADIUS = 15
const MARKER_LOGO_SIZE = 22

export function TeamLogoBadge({ logo, size }: { logo: string; size: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${size}`}
      style={{ backgroundColor: BADGE_FILL }}
    >
      <img src={logo} alt="" className="h-[75%] w-[75%] object-contain" />
    </span>
  )
}

// Scatter marker. The 2px ring in the panel's surface color separates
// overlapping badges, and the badge (30px+) is the hover target, well above
// the 24px minimum.
export function TeamLogoMarker({ cx, cy, payload }: { cx?: number; cy?: number; payload?: { logo: string } }) {
  if (cx === undefined || cy === undefined || !payload) return null
  return (
    <g className="origin-center cursor-pointer transition-transform duration-150 [transform-box:fill-box] hover:scale-125 hover:[filter:drop-shadow(0_0_6px_rgba(37,106,191,0.45))]">
      <circle cx={cx} cy={cy} r={MARKER_RADIUS} fill={BADGE_FILL} stroke="var(--surface-1)" strokeWidth={2} />
      <image
        href={payload.logo}
        x={cx - MARKER_LOGO_SIZE / 2}
        y={cy - MARKER_LOGO_SIZE / 2}
        width={MARKER_LOGO_SIZE}
        height={MARKER_LOGO_SIZE}
      />
    </g>
  )
}
