// playerVisuals.ts
// Shared helpers for rendering a player as a small colored marker (team
// color + initials), used by any chart that plots individual players.

// "Patrick Mahomes" -> "PM". Uses the second word, not the last, so compound
// surnames read correctly: "Amon-Ra St. Brown" -> "AS", not "AB" from
// jumping straight to "Brown".
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// Dark text on light team colors, light text on dark ones. Fixed black/white,
// not theme tokens - this text sits on an arbitrary team color, not the app's
// own surface, so it needs to stay legible no matter what the page theme is.
export function readableTextColor(hex: string): string {
  const value = hex.replace("#", "")
  if (value.length !== 6) return "#0b0b0b"
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance > 140 ? "#0b0b0b" : "#ffffff"
}
