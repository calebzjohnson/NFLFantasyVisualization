// PlayerAvatar.tsx
// Round player headshot (CDN-resized), falling back to team-colored initials when there's no photo.
import { headshotUrl } from "../lib/imageUrls"
import { initialsFor, readableTextColor } from "../lib/playerVisuals"

interface PlayerAvatarProps {
  name: string
  headshot: string | null
  color: string
  // Tailwind size classes, e.g. "h-8 w-8" - the 192px image covers up to ~64px.
  size: string
}

function PlayerAvatar({ name, headshot, color, size }: PlayerAvatarProps) {
  if (headshot) {
    return (
      <img
        src={headshotUrl(headshot)}
        alt=""
        className={`${size} shrink-0 rounded-full object-cover`}
        style={{ backgroundColor: color }}
      />
    )
  }
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold`}
      style={{ backgroundColor: color, color: readableTextColor(color) }}
    >
      {initialsFor(name)}
    </span>
  )
}

export default PlayerAvatar
