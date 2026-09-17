function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Standard NFL passer rating formula.
export function passerRating(cmp: number, att: number, yards: number, td: number, int: number): number {
  if (att === 0) return 0
  const a = clamp((cmp / att - 0.3) * 5, 0, 2.375)
  const b = clamp((yards / att - 3) * 0.25, 0, 2.375)
  const c = clamp((td / att) * 20, 0, 2.375)
  const d = clamp(2.375 - (int / att) * 25, 0, 2.375)
  return Math.round(((a + b + c + d) / 6) * 1000) / 10
}

export function perAttempt(yards: number, attempts: number): number {
  return attempts === 0 ? 0 : Math.round((yards / attempts) * 10) / 10
}
