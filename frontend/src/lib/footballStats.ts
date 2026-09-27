// footballStats.ts
// Pure football stat formulas (passer rating, per-attempt averages, tackles).
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

// Solo tackles plus assisted-tackle credits - the combined total PFR reports.
export function totalTackles(row: Record<string, unknown>): number {
  return (
    Number(row.def_tackles_solo ?? 0) + Number(row.def_tackles_with_assist ?? 0) + Number(row.def_tackle_assists ?? 0)
  )
}

export const TACKLE_FIELDS = ["def_tackles_solo", "def_tackles_with_assist", "def_tackle_assists"]
