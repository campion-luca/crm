import type { LogoBg } from '@/lib/brand'

/** Apre un'immagine (anche SVG) da un Blob; l'object URL vive solo durante `fn`. */
async function withImage<T>(blob: Blob, fn: (img: HTMLImageElement) => T): Promise<T> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return await fn(img)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Dimensioni di un SVG: width/height in px se ci sono, altrimenti il viewBox
 * (il browser per un SVG senza dimensioni riporta 300 px di larghezza).
 */
async function svgSize(blob: Blob): Promise<{ w: number; h: number } | null> {
  const root = /<svg\b[^>]*>/i.exec(await blob.text())?.[0] ?? ''
  const attr = (n: string) => new RegExp(`\\s${n}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, 'i').exec(root)
  const w = attr('width')
  const h = attr('height')
  if (w && h) return { w: Math.round(Number(w[1])), h: Math.round(Number(h[1])) }
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(root)
  return vb ? { w: Math.round(Number(vb[1])), h: Math.round(Number(vb[2])) } : null
}

const natural = (img: HTMLImageElement) => ({ w: img.naturalWidth || 300, h: img.naturalHeight || 150 })

/**
 * Dimensioni e sfondo consigliato: un logo chiaro su fondo trasparente (versione in negativo)
 * si vede solo su fondo scuro.
 */
export async function analyzeLogo(blob: Blob): Promise<{ w?: number; h?: number; bg: LogoBg }> {
  try {
    const isSvg = blob.type === 'image/svg+xml'
    return await withImage(blob, async (img) => {
      const size = isSvg ? ((await svgSize(blob)) ?? natural(img)) : img.naturalWidth ? natural(img) : null
      let bg: LogoBg = 'light'
      try {
        const S = 48
        const c = document.createElement('canvas')
        c.width = c.height = S
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          const { w, h } = natural(img)
          const k = Math.min(S / w, S / h)
          ctx.drawImage(img, 0, 0, w * k, h * k)
          const px = ctx.getImageData(0, 0, S, S).data
          let opaque = 0
          let clear = 0
          let lum = 0
          for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3]! < 128) {
              clear++
              continue
            }
            opaque++
            lum += (0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!) / 255
          }
          if (opaque && clear / (opaque + clear) > 0.05 && lum / opaque > 0.82) bg = 'dark'
        }
      } catch {
        // canvas non leggibile (alcuni SVG in Safari): resta lo sfondo chiaro
      }
      return size ? { ...size, bg } : { bg }
    })
  } catch {
    return { bg: 'light' }
  }
}

const AVATAR_PX = 128
export const LOGO_BG: Record<LogoBg, string> = { light: '#ffffff', dark: '#16161b' }

/**
 * Miniatura quadrata del logo per l'avatar dell'azienda (data URL, pochi KB): si salva insieme ai dati,
 * così compare subito in sidebar e card, anche offline, senza scaricare il file.
 */
export function makeAvatar(blob: Blob, bg: LogoBg): Promise<string> {
  return withImage(blob, (img) => {
    const c = document.createElement('canvas')
    c.width = c.height = AVATAR_PX
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('Canvas non disponibile')
    ctx.fillStyle = LOGO_BG[bg]
    ctx.fillRect(0, 0, AVATAR_PX, AVATAR_PX)
    const { w, h } = natural(img)
    const box = AVATAR_PX * 0.84
    const k = Math.min(box / w, box / h)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, (AVATAR_PX - w * k) / 2, (AVATAR_PX - h * k) / 2, w * k, h * k)
    // WebP dove il browser lo sa scrivere, altrimenti PNG (Safari)
    return c.toDataURL('image/webp', 0.9)
  })
}
