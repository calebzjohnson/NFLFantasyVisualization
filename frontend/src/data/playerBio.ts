// playerBio.ts
// Type for /players/:id/bio, plus the formatting its ESPN-style header needs.
export interface PlayerBio {
  player_id: string
  display_name: string
  position: string | null
  team: string | null
  jersey_number: string | null
  height_in: number | null
  weight_lb: number | null
  birth_date: string | null
  college: string | null
  status: string | null
  draft_year: number | null
  draft_round: number | null
  draft_pick: number | null
  draft_team: string | null
  headshot_url: string | null
}

export function formatHeightWeight(bio: PlayerBio): string | null {
  const height =
    bio.height_in !== null ? `${Math.floor(bio.height_in / 12)}' ${bio.height_in % 12}"` : null
  const weight = bio.weight_lb !== null ? `${bio.weight_lb} lbs` : null
  return [height, weight].filter(Boolean).join(", ") || null
}

// Parses "YYYY-MM-DD" by hand rather than `new Date(birthDate)` - the latter
// parses as UTC midnight, which can shift a day off in the browser's local
// timezone and throw off both the age and the displayed date.
function parseIsoDate(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.split("-").map(Number)
  return { year, month, day }
}

export function formatAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const { year, month, day } = parseIsoDate(birthDate)
  const today = new Date()
  const hadBirthdayThisYear =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day)
  return today.getFullYear() - year - (hadBirthdayThisYear ? 0 : 1)
}

export function formatBirthDate(birthDate: string): string {
  const { year, month, day } = parseIsoDate(birthDate)
  return `${month}/${day}/${year}`
}

export function formatDraftInfo(bio: PlayerBio): string {
  if (bio.draft_year === null) return "Undrafted"
  return `${bio.draft_year}: Rd ${bio.draft_round}, Pk ${bio.draft_pick} (${bio.draft_team})`
}
