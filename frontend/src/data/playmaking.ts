// playmaking.ts
// Types for /teams/{team}/playmaking, plus the red-zone share maths.
import type { UsageShare } from "./usage"

export interface PlaymakingPlayer {
  player_id: string
  name: string | null
  headshot_url: string | null
  value: number
}

export interface RedZonePlayer {
  player_id: string
  name: string | null
  headshot_url: string | null
  touches: number
}

export interface LeaderGroup {
  key: string
  label: string
  players: PlaymakingPlayer[]
}

export interface PlaymakingResponse {
  team: string
  touches: UsageShare
  targets: UsageShare
  red_zone: { total: number; players: RedZonePlayer[] }
  leaders: LeaderGroup[]
}

export const RED_ZONE_SHOWN = 5

/** Each player's cut of the team's red-zone touches, biggest first. */
export function redZoneShare(
  total: number,
  players: RedZonePlayer[],
): { player: RedZonePlayer; pct: number }[] {
  if (total <= 0) return []
  return players
    .slice(0, RED_ZONE_SHOWN)
    .map((player) => ({ player, pct: (player.touches / total) * 100 }))
}
