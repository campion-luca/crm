/** Stima in minuti → "45 min", "1,5 h", "2 h". Zero o vuoto → "". */
export function fmtEst(min: number | null | undefined): string {
  const m = Math.max(0, Math.round(min ?? 0))
  if (!m) return ''
  if (m < 60) return `${m} min`
  const h = m / 60
  return `${(m % 60 ? h.toFixed(1) : h.toFixed(0)).replace('.', ',')} h`
}

/** Ore decimali → "2,5 h" (per le ore disponibili nel calendario). */
export function fmtHours(h: number): string {
  const v = Math.round(h * 10) / 10
  return `${String(v).replace('.', ',')} h`
}

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

export const newId = (): string => crypto.randomUUID()
