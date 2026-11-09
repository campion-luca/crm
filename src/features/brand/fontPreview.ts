import { useQuery } from '@tanstack/react-query'
import type { FileStore } from '@/data/files'
import { googleFontsCss, isGoogleFontsUrl, previewFile, type BrandFont, type FontFile } from '@/lib/brand'
import { useFiles } from './useBrand'

/**
 * Da dove arriva l'anteprima di un font:
 * file caricato → Google Fonts (se il link punta lì) → font installato sul dispositivo.
 */
export type FontStatus = 'file' | 'google' | 'installed' | 'missing' | 'error'

export const FONT_STATUS_TEXT: Record<FontStatus, string> = {
  file: 'Anteprima dal file caricato',
  google: 'Anteprima da Google Fonts',
  installed: 'Installato su questo dispositivo',
  missing: 'Non trovato su questo dispositivo: anteprima con il font di sistema',
  error: 'File non leggibile: anteprima con il font di sistema',
}

const faces = new Map<string, Promise<string>>()

/** Registra il file come FontFace con un nome interno, così non si confonde con font installati. */
function loadFile(files: FileStore, file: FontFile): Promise<string> {
  let p = faces.get(file.path)
  if (!p) {
    p = (async () => {
      const buf = await (await files.download(file.path)).arrayBuffer()
      const alias = `brand-${file.path.replace(/[^a-z0-9]/gi, '').slice(-24)}`
      const face = new FontFace(alias, buf)
      await face.load()
      document.fonts.add(face)
      return alias
    })()
    p.catch(() => faces.delete(file.path))
    faces.set(file.path, p)
  }
  return p
}

const sheets = new Map<string, Promise<void>>()

/** Il foglio di Google Fonts si carica solo per i font che hanno un link a Google Fonts. */
async function loadGoogle(family: string): Promise<boolean> {
  let p = sheets.get(family)
  if (!p) {
    p = new Promise<void>((resolve) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = googleFontsCss(family)
      link.onload = () => resolve()
      link.onerror = () => resolve()
      document.head.append(link)
    })
    sheets.set(family, p)
  }
  await p
  const loaded = await document.fonts.load(`32px "${family}"`)
  return loaded.length > 0
}

/** Confronta la larghezza del testo con i font generici: se cambia, il font è installato. */
function isInstalled(family: string): boolean {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return false
  const sample = 'mmmmmmmmmmlliiWWQ@#0123'
  for (const generic of ['monospace', 'serif', 'sans-serif']) {
    ctx.font = `72px ${generic}`
    const base = ctx.measureText(sample).width
    ctx.font = `72px "${family}", ${generic}`
    if (ctx.measureText(sample).width !== base) return true
  }
  return false
}

const clean = (family: string) => family.replace(/["\\;{}]/g, '').trim()

export function useFontPreview(font: BrandFont) {
  const files = useFiles()
  const file = previewFile(font.files)
  const google = !file && isGoogleFontsUrl(font.url)
  const family = clean(font.family)
  const q = useQuery({
    queryKey: ['font-preview', file?.path ?? '', google, family],
    queryFn: async (): Promise<{ family: string; status: FontStatus }> => {
      if (file) {
        try {
          return { family: await loadFile(files, file), status: 'file' }
        } catch {
          return { family, status: 'error' }
        }
      }
      if (google) return { family, status: (await loadGoogle(family)) ? 'google' : 'missing' }
      return { family, status: isInstalled(family) ? 'installed' : 'missing' }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    meta: { persist: false },
  })
  return {
    fontFamily: `"${q.data?.family ?? family}", system-ui, sans-serif`,
    status: q.data?.status,
  }
}
