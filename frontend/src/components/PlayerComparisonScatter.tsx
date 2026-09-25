// PlayerComparisonScatter.tsx
// Compare Players: every player in the active position group on a
// pick-your-axes scatter (see MetricScatter). Markers are player headshots in
// a team-colored ring (initials when there's no photo). An earlier headshot
// version was slow because it drew ~170 full-size (~630 KB, 3400px) photos,
// each with its own clipPath; these are 128px, pre-cropped round by the CDN
// (~7 KB each), so there's nothing to clip.
import { memo, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import type { PositionGroup } from "../data/leaderCategories"
import { PLAYER_METRICS, playersPathForPosition, type PlayerStatsRow } from "../data/playerMetrics"
import type { TeamInfo } from "../data/teams"
import { headshotUrl } from "../lib/imageUrls"
import { initialsFor, readableTextColor } from "../lib/playerVisuals"
import { useFetch } from "../lib/useFetch"
import MetricScatter from "./MetricScatter"
import PlayerAvatar from "./PlayerAvatar"

type PlayerPoint = PlayerStatsRow & { color: string }

const MARKER_RADIUS = 11
// Team-color ring width around a headshot.
const RING = 2
// ~6x the photo's on-screen size, the ratio that looked sharp for leader avatars.
const MARKER_PHOTO_PX = 128

// A team-colored dot showing the player's headshot (or initials, with no
// photo), with a surface-color ring so it stays legible where points overlap.
// The transparent hit circle keeps the hover/focus target >=24px even though
// the visible mark is smaller.
// Memoized so hovering one marker doesn't force the other ~170 to re-render.
const PlayerDot = memo(function PlayerDot({
  cx,
  cy,
  payload,
  onSelect,
}: {
  cx?: number
  cy?: number
  payload?: PlayerPoint
  onSelect?: (point: PlayerPoint) => void
}) {
  if (cx === undefined || cy === undefined || !payload) return null

  return (
    <g
      onClick={() => onSelect?.(payload)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect?.(payload)
      }}
      aria-label={`View ${payload.player_display_name}'s player page`}
      className="origin-center cursor-pointer transition-transform duration-150 [transform-box:fill-box] hover:scale-125"
    >
      <circle cx={cx} cy={cy} r={16} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={MARKER_RADIUS}
        fill={payload.color}
        stroke="var(--surface-1)"
        strokeWidth={2}
      />
      {payload.headshot_url ? (
        <image
          href={headshotUrl(payload.headshot_url, MARKER_PHOTO_PX, true)}
          x={cx - MARKER_RADIUS + RING}
          y={cy - MARKER_RADIUS + RING}
          width={(MARKER_RADIUS - RING) * 2}
          height={(MARKER_RADIUS - RING) * 2}
        />
      ) : (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fontWeight={700}
          fill={readableTextColor(payload.color)}
        >
          {initialsFor(payload.player_display_name)}
        </text>
      )}
    </g>
  )
})

// Tooltip header: a bigger (non-round, 192px) headshot beside the name and team.
function TooltipHeader({ point }: { point: PlayerPoint }) {
  return (
    <div className="flex items-center gap-2">
      <PlayerAvatar
        name={point.player_display_name}
        headshot={point.headshot_url}
        color={point.color}
        size="h-9 w-9"
      />
      <div>
        <div className="text-sm text-[var(--text-primary)]">{point.player_display_name}</div>
        <div className="text-[10px] font-normal tracking-wider text-[var(--text-muted)] uppercase">
          {point.recent_team}
        </div>
      </div>
    </div>
  )
}

function PlayerComparisonScatter({ position }: { position: PositionGroup }) {
  const navigate = useNavigate()
  const { data, error, loading } = useFetch<PlayerStatsRow[]>(playersPathForPosition(position))
  const teams = useFetch<TeamInfo[]>("/teams")

  const rows = useMemo<PlayerPoint[] | null>(() => {
    if (!data) return null
    const colorByTeam = new Map(teams.data?.map((team) => [team.team_abbr, team.team_color]))
    return data.map((row) => ({ ...row, color: colorByTeam.get(row.recent_team) ?? "var(--accent)" }))
  }, [data, teams.data])

  function goToPlayer(point: PlayerPoint) {
    navigate(`/players/${point.player_id}`, { state: { playerName: point.player_display_name } })
  }

  return (
    // Keyed by position so switching positions resets the axes to that
    // position's own defaults instead of keeping a stale metric.
    <MetricScatter
      key={position}
      title="Compare Players"
      metrics={PLAYER_METRICS[position]}
      rows={rows}
      loading={loading}
      error={error}
      noun="players"
      emptyText={`No ${position}s with stats yet.`}
      Dot={(props) => <PlayerDot {...props} onSelect={goToPlayer} />}
      renderTooltipHeader={(point) => <TooltipHeader point={point} />}
      caption={
        <>
          Each dot is a {position}, positioned by the two stats you pick above. The lighter lines mark
          the median {position} in each stat, splitting the chart into four quadrants - so a player
          above both lines is beating the middle of the pack on both stats at once.
        </>
      }
    />
  )
}

export default PlayerComparisonScatter
