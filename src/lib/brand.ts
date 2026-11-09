// Setup aziendale: logo, colori, font, tono di voce e documenti di ogni azienda (companies.brand).
// zod/mini come in profile.ts: il parsing gira in normalize, quindi nel bundle iniziale.
import * as z from 'zod/mini'
import type { CompanyProfile } from './profile'

export const COLOR_ROLES = [
  { id: 'primary', label: 'Primario' },
  { id: 'secondary', label: 'Secondario' },
  { id: 'accent', label: 'Accento' },
  { id: 'neutral', label: 'Neutro' },
  { id: 'other', label: 'Altro' },
] as const
export type ColorRole = (typeof COLOR_ROLES)[number]['id']
const COLOR_ROLE_IDS = COLOR_ROLES.map((r) => r.id) as [ColorRole, ...ColorRole[]]

export const FONT_ROLES = [
  { id: 'heading', label: 'Titoli' },
  { id: 'body', label: 'Testo' },
  { id: 'accent', label: 'Accento' },
  { id: 'other', label: 'Altro' },
] as const
export type FontRole = (typeof FONT_ROLES)[number]['id']
const FONT_ROLE_IDS = FONT_ROLES.map((r) => r.id) as [FontRole, ...FontRole[]]

export const colorRoleLabel = (r: ColorRole) => COLOR_ROLES.find((x) => x.id === r)?.label ?? 'Altro'
export const fontRoleLabel = (r: FontRole) => FONT_ROLES.find((x) => x.id === r)?.label ?? 'Altro'

const optionalText = z.catch(z.optional(z.string().check(z.trim())), undefined)
const id = z.string().check(z.minLength(1))

/** File nello storage (Supabase Storage o IndexedDB in modalità locale). */
const fileRefSchema = z.object({
  path: z.string().check(z.minLength(1)),
  name: z.catch(z.string(), 'file'),
  mime: z.catch(z.string(), ''),
  size: z.catch(z.number(), 0),
})
export type FileRef = z.infer<typeof fileRefSchema>

const fontFileSchema = z.extend(fileRefSchema, { style: optionalText })
export type FontFile = z.infer<typeof fontFileSchema>

const logoSchema = z.object({
  id,
  label: z.catch(z.string(), 'Logo'),
  file: fileRefSchema,
  /** sfondo per cui è pensato: "dark" per le versioni in negativo */
  bg: z.catch(z.enum(['light', 'dark']), 'light'),
  w: z.catch(z.optional(z.number()), undefined),
  h: z.catch(z.optional(z.number()), undefined),
})
export type BrandLogo = z.infer<typeof logoSchema>
export type LogoBg = BrandLogo['bg']

const colorSchema = z.object({
  id,
  name: z.catch(z.string(), ''),
  hex: z.string().check(z.regex(/^#[0-9a-f]{6}$/i)),
  role: z.catch(z.enum(COLOR_ROLE_IDS), 'other'),
  /** Pantone, CMYK o altre indicazioni del brand book */
  note: optionalText,
})
export type BrandColor = z.infer<typeof colorSchema>

const fontBaseSchema = z.object({
  id,
  family: z.string().check(z.trim(), z.minLength(1)),
  role: z.catch(z.enum(FONT_ROLE_IDS), 'other'),
  weights: optionalText,
  url: optionalText,
})
export type BrandFont = z.infer<typeof fontBaseSchema> & { files: FontFile[] }

const docBaseSchema = z.object({
  id,
  label: z.catch(z.string(), ''),
  url: optionalText,
  file: z.catch(z.optional(fileRefSchema), undefined),
})
export type BrandDoc = z.infer<typeof docBaseSchema>

export interface CompanyBrand {
  logos: BrandLogo[]
  /** miniatura quadrata del logo scelto (data URL), usata come avatar dell'azienda nell'app */
  avatar?: string | undefined
  /** id del logo da cui è stata generata la miniatura */
  avatarOf?: string | undefined
  colors: BrandColor[]
  fonts: BrandFont[]
  payoff?: string | undefined
  tone?: string | undefined
  hashtags?: string | undefined
  guidelines?: string | undefined
  docs: BrandDoc[]
}

export const emptyBrand = (): CompanyBrand => ({ logos: [], colors: [], fonts: [], docs: [] })

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/** Un elemento malformato viene scartato da solo, senza svuotare l'intero elenco. */
function list<T>(raw: unknown, parse: (x: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return []
  const out: T[] = []
  for (const x of raw) {
    const v = parse(x)
    if (v) out.push(v)
  }
  return out
}

const via =
  <T>(schema: z.ZodMiniType<T>) =>
  (x: unknown): T | null => {
    const r = schema.safeParse(x)
    return r.success ? r.data : null
  }

function parseFont(x: unknown): BrandFont | null {
  const r = fontBaseSchema.safeParse(x)
  if (!r.success) return null
  return { ...r.data, files: list((x as Obj).files, via(fontFileSchema)) }
}

function parseDoc(x: unknown): BrandDoc | null {
  const r = docBaseSchema.safeParse(x)
  return r.success && (r.data.url || r.data.file) ? r.data : null
}

/** Solo immagini raster inline: niente URL esterni (tracciamento) né SVG (script). */
const AVATAR_RE = /^data:image\/(png|webp|jpeg);base64,[a-z0-9+/=]+$/i
const AVATAR_MAX = 200_000

/**
 * Legge companies.brand in modo tollerante. Se il setup non è mai stato salvato, recupera i colori
 * e i font che stavano nella scheda azienda (profile.brandColors / profile.fonts, formato precedente).
 */
export function parseBrand(raw: unknown, legacy?: CompanyProfile): CompanyBrand {
  const o = isObj(raw) ? raw : {}
  const avatar =
    typeof o.avatar === 'string' && o.avatar.length <= AVATAR_MAX && AVATAR_RE.test(o.avatar)
      ? o.avatar
      : undefined
  const brand: CompanyBrand = {
    logos: list(o.logos, via(logoSchema)),
    avatar,
    avatarOf: avatar ? text(o.avatarOf) : undefined,
    colors: list(o.colors, via(colorSchema)).map((c) => ({ ...c, hex: c.hex.toLowerCase() })),
    fonts: list(o.fonts, parseFont),
    payoff: text(o.payoff),
    tone: text(o.tone),
    hashtags: text(o.hashtags),
    guidelines: text(o.guidelines),
    docs: list(o.docs, parseDoc),
  }
  if (legacy && Object.keys(o).length === 0) {
    brand.colors = legacy.brandColors
      .filter((h) => /^#[0-9a-f]{6}$/i.test(h))
      .map((hex, i) => ({
        id: `legacy-color-${i}`,
        name: '',
        hex: hex.toLowerCase(),
        role: i === 0 ? 'primary' : 'other',
        note: undefined,
      }))
    brand.fonts = splitLegacyFonts(legacy.fonts)
  }
  return brand
}

/**
 * "Titoli: Playfair Display · Testi: Lato" → due font con il loro ruolo.
 * Senza etichette il primo è per i titoli, il secondo per il testo.
 */
export function splitLegacyFonts(value: string | undefined): BrandFont[] {
  if (!value?.trim()) return []
  const seen = new Set<string>()
  const out: BrandFont[] = []
  for (const part of value.split(/[,;/+·|\n]|\s+e\s+/i)) {
    const m = /^\s*([^:]*):\s*(.+)$/.exec(part)
    const label = m?.[1]?.trim() ?? ''
    const family = (m?.[2] ?? part).trim()
    if (!family || seen.has(family.toLowerCase())) continue
    seen.add(family.toLowerCase())
    const role: FontRole = /titol|head/i.test(label)
      ? 'heading'
      : /test|body|paragraf|corpo/i.test(label)
        ? 'body'
        : out.length === 0
          ? 'heading'
          : out.length === 1
            ? 'body'
            : 'other'
    out.push({
      id: `legacy-font-${out.length}`,
      family,
      role,
      weights: undefined,
      url: undefined,
      files: [],
    })
  }
  return out
}

export function isBrandEmpty(b: CompanyBrand): boolean {
  return (
    !b.logos.length &&
    !b.colors.length &&
    !b.fonts.length &&
    !b.docs.length &&
    !b.payoff &&
    !b.tone &&
    !b.hashtags &&
    !b.guidelines
  )
}

/** Tutti i file a cui il setup fa riferimento (per eliminarli insieme all'azienda). */
export function brandFilePaths(b: CompanyBrand): string[] {
  return [
    ...b.logos.map((l) => l.file.path),
    ...b.fonts.flatMap((f) => f.files.map((x) => x.path)),
    ...b.docs.flatMap((d) => (d.file ? [d.file.path] : [])),
  ]
}

/**
 * Il backup JSON contiene il setup ma non i file: loghi, file dei font e documenti caricati restano
 * nello storage dell'account di origine, quindi nel ripristino vengono tolti (link e testi restano).
 */
export function withoutFiles(b: CompanyBrand): CompanyBrand {
  return {
    ...b,
    logos: [],
    avatar: undefined,
    avatarOf: undefined,
    fonts: b.fonts.map((f) => ({ ...f, files: [] })),
    docs: b.docs.filter((d) => d.url).map((d) => ({ ...d, file: undefined })),
  }
}

// ---------------------------------------------------------------- colori

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const rgbText = (hex: string) => hexToRgb(hex).join(', ')

/** Luminanza relativa WCAG 2.x. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

export type ContrastLevel = 'AAA' | 'AA' | 'AA grande' | 'Basso'

/** Testo bianco o nero su questo colore: quello che si legge meglio, con il livello WCAG. */
export function textOn(hex: string): { ink: '#ffffff' | '#000000'; ratio: number; level: ContrastLevel } {
  const white = contrastRatio(hex, '#ffffff')
  const black = contrastRatio(hex, '#000000')
  const ink = white >= black ? '#ffffff' : '#000000'
  const ratio = Math.max(white, black)
  const level: ContrastLevel = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA grande' : 'Basso'
  return { ink, ratio, level }
}

export function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Variabili CSS della palette e dei font, da incollare in un foglio di stile. */
export function brandCss(b: CompanyBrand): string {
  const used = new Set<string>()
  const unique = (base: string) => {
    let name = base
    for (let i = 2; used.has(name); i++) name = `${base}-${i}`
    used.add(name)
    return name
  }
  const lines: string[] = []
  for (const c of b.colors) {
    lines.push(`  --${unique(`color-${slug(c.name) || slug(colorRoleLabel(c.role))}`)}: ${c.hex};`)
  }
  for (const f of b.fonts) {
    const generic = /mono|code/i.test(f.family) ? 'monospace' : 'sans-serif'
    lines.push(
      `  --${unique(`font-${slug(fontRoleLabel(f.role))}`)}: "${f.family.replace(/"/g, '')}", ${generic};`,
    )
  }
  return `:root {\n${lines.join('\n')}\n}`
}

// ---------------------------------------------------------------- file

export function fileExt(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name)
  return m ? m[1]!.toLowerCase() : ''
}

export const baseName = (name: string) => name.replace(/\.[a-z0-9]{1,8}$/i, '')

const LOGO_EXT = ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif']
const FONT_EXT = ['woff2', 'woff', 'ttf', 'otf']

export const LOGO_ACCEPT =
  '.svg,.png,.jpg,.jpeg,.webp,.gif,image/svg+xml,image/png,image/jpeg,image/webp,image/gif'
export const FONT_ACCEPT = '.woff2,.woff,.ttf,.otf'

export const isLogoFile = (f: { name: string; type: string }) =>
  LOGO_EXT.includes(fileExt(f.name)) || /^image\/(svg\+xml|png|jpeg|webp|gif)$/.test(f.type)
export const isFontFile = (f: { name: string }) => FONT_EXT.includes(fileExt(f.name))

/** Content type affidabile: per i font il browser spesso non lo indica. */
export function mimeOf(f: { name: string; type: string }): string {
  const ext = fileExt(f.name)
  if (FONT_EXT.includes(ext)) return `font/${ext}`
  if (ext === 'svg') return 'image/svg+xml'
  return f.type || 'application/octet-stream'
}

const nf = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 })

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${nf.format(n / (1024 * 1024))} MB`
}

const WEIGHT_NAMES: Record<string, string> = {
  '100': 'Thin',
  '200': 'ExtraLight',
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'SemiBold',
  '700': 'Bold',
  '800': 'ExtraBold',
  '900': 'Black',
}
const STYLE_WORDS = new Set([
  'thin',
  'hairline',
  'extralight',
  'ultralight',
  'light',
  'regular',
  'normal',
  'book',
  'roman',
  'medium',
  'semibold',
  'demibold',
  'bold',
  'extrabold',
  'ultrabold',
  'black',
  'heavy',
  'italic',
  'oblique',
  'variable',
  'vf',
])
/** parole dei nomi file che non fanno parte del nome del font (subset, formato web) */
const NOISE_WORDS = new Set(['latin', 'ext', 'cyrillic', 'greek', 'vietnamese', 'subset', 'webfont', 'web'])

const cap = (w: string) => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w)

/**
 * Nome del font e stile dal nome del file: "OpenSans-BoldItalic.ttf" → Open Sans · Bold Italic,
 * "plus-jakarta-sans-latin-400-normal.woff2" → Plus Jakarta Sans · Regular.
 */
export function fontFromFileName(fileName: string): { family: string; style: string } {
  const words = baseName(fileName)
    .split(/[-_\s.]+/)
    .flatMap((t) => (/[a-z][A-Z]/.test(t) ? t.split(/(?<=[a-z])(?=[A-Z])/) : [t]))
    .filter(Boolean)
    // "Semi" + "Bold" → "SemiBold": riunisce gli stili composti spezzati dal camelCase
    .reduce<string[]>((acc, w) => {
      const prev = acc[acc.length - 1]
      if (prev && STYLE_WORDS.has((prev + w).toLowerCase())) acc[acc.length - 1] = prev + w
      else acc.push(w)
      return acc
    }, [])
  const isMeta = (w: string) => {
    const l = w.toLowerCase()
    return STYLE_WORDS.has(l) || NOISE_WORDS.has(l) || /^\d{3}$/.test(l) || /^\d+pt$/.test(l)
  }
  const cut = words.findIndex((w, i) => i > 0 && isMeta(w))
  const familyWords = cut === -1 ? words : words.slice(0, cut)
  const rest = cut === -1 ? [] : words.slice(cut)
  const style = rest
    .map((w) => WEIGHT_NAMES[w] ?? w)
    .filter((w) => STYLE_WORDS.has(w.toLowerCase()) || Object.values(WEIGHT_NAMES).includes(w))
    .filter((w, _i, a) => !(w.toLowerCase() === 'normal' && a.length > 1))
    .map((w) => (w.toLowerCase() === 'normal' ? 'Regular' : cap(w)))
  return {
    family: familyWords.map(cap).join(' ') || baseName(fileName),
    style: [...new Set(style)].join(' ') || 'Regular',
  }
}

/** File da usare per l'anteprima: il Regular se c'è, altrimenti il primo. */
export function previewFile(files: FontFile[]): FontFile | undefined {
  return files.find((f) => /regular|normal|book|roman|^$/i.test(f.style ?? '')) ?? files[0]
}

export const isGoogleFontsUrl = (url: string | undefined) =>
  !!url && /^(https?:\/\/)?fonts\.(google|googleapis)\.com\//i.test(url.trim())

export const googleFontsCss = (family: string) =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family.trim()).replace(/%20/g, '+')}&display=swap`
