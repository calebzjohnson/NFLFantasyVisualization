// imageUrls.ts
// Rewrites nflverse's full-size headshot and team logo URLs to small, CDN-resized versions.

// nflverse headshots are ~3400x2450 originals (~630 KB each) on the NFL's
// image CDN. Every URL carries an `f_auto,q_auto` transform segment, so adding
// a size there makes the CDN resize before download. A URL without that
// segment passes through unchanged (full size, but still works).
const HEADSHOT_TRANSFORM = "/f_auto,q_auto/"

// 192px (~11 KB) was checked side by side against the original for a
// 32-36px avatar; use a bigger size for bigger avatars. g_face centers the
// square crop on the player's face. `round` has the CDN cut the circle too
// (transparent corners), so SVG markers don't need a clipPath each.
export function headshotUrl(url: string, size = 192, round = false): string {
  const transform = `f_auto,q_auto:best,w_${size},h_${size},c_fill,g_face${round ? ",r_max" : ""}`
  return url.replace(HEADSHOT_TRANSFORM, `/${transform}/`)
}

// ESPN's 500px logos (~42 KB) through ESPN's own resizing endpoint (~3 KB).
// One fixed size everywhere, so every panel shares the same cached download.
const ESPN_LOGO = /^https:\/\/a\.espncdn\.com(\/i\/teamlogos\/.+)$/
const LOGO_SIZE = 64

export function teamLogoUrl(url: string): string {
  const match = ESPN_LOGO.exec(url)
  return match ? `https://a.espncdn.com/combiner/i?img=${match[1]}&w=${LOGO_SIZE}&h=${LOGO_SIZE}` : url
}
