/** Palette aziende: tinte lontane tra loro, nell'ordine in cui vengono assegnate. */
export const COMPANY_COLORS = [
  '#ffe08a', // giallo pastello
  '#12b76a', // verde
  '#1d3fae', // blu scuro
  '#ff5a5f',
  '#a64dff',
  '#00b8d9',
  '#ff7a1a',
  '#e83e8c',
  '#7cb518',
  '#2f6bff',
  '#ffb000',
  '#475467',
] as const

/** Primo colore non ancora usato; se sono finiti riparte dalla palette in ordine. */
export function nextCompanyColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()))
  return COMPANY_COLORS.find((c) => !taken.has(c)) ?? COMPANY_COLORS[used.length % COMPANY_COLORS.length]!
}

/** color-mix del colore su una base (default trasparente), es. sfondi al 16% / 26% / 28%. */
export const tint = (color: string, pct: number, base = 'transparent') =>
  `color-mix(in srgb, ${color} ${pct}%, ${base})`

export const FALLBACK_COLOR = '#888888'
