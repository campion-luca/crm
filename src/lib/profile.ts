// zod/mini: stessa validazione di zod ma tree-shakable, perché questo schema è nel bundle iniziale
// (i form, caricati a parte, usano zod classico)
import * as z from 'zod/mini'

export const SOCIAL_KEYS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube'] as const
export type SocialKey = (typeof SOCIAL_KEYS)[number]

export const SOCIALS: { key: SocialKey; label: string; base: string }[] = [
  { key: 'instagram', label: 'Instagram', base: 'https://instagram.com/' },
  { key: 'facebook', label: 'Facebook', base: 'https://facebook.com/' },
  { key: 'linkedin', label: 'LinkedIn', base: 'https://linkedin.com/company/' },
  { key: 'tiktok', label: 'TikTok', base: 'https://tiktok.com/@' },
  { key: 'youtube', label: 'YouTube', base: 'https://youtube.com/@' },
]

const optionalText = z.catch(z.optional(z.string().check(z.trim())), undefined)

export const contactSchema = z.object({
  name: z.catch(z.string(), ''),
  role: optionalText,
  email: optionalText,
  phone: optionalText,
})

/** Scheda anagrafica dell'azienda, salvata in companies.profile (jsonb). */
export const companyProfileSchema = z.object({
  contacts: z.catch(z.array(contactSchema), []),
  website: optionalText,
  links: z.catch(z.array(z.object({ label: z.catch(z.string(), ''), url: z.catch(z.string(), '') })), []),
  social: z.catch(z.partialRecord(z.enum(SOCIAL_KEYS), z.string()), {}),
  /** formato precedente: ora colori e font stanno nel Setup aziendale (companies.brand) */
  brandColors: z.catch(z.array(z.string()), []),
  /** formato precedente, vedi brandColors */
  fonts: optionalText,
  address: optionalText,
  vat: optionalText,
  notes: optionalText,
})

export type CompanyProfile = z.infer<typeof companyProfileSchema>
export type Contact = z.infer<typeof contactSchema>

export const emptyProfile = (): CompanyProfile => ({
  contacts: [],
  links: [],
  social: {},
  brandColors: [],
})

/** Legge il jsonb in modo tollerante: i campi malformati diventano vuoti invece di rompere la pagina. */
export function parseProfile(raw: unknown): CompanyProfile {
  const res = companyProfileSchema.safeParse(withCleanSocial(raw ?? {}))
  return res.success ? res.data : emptyProfile()
}

/** Tiene solo i social noti con valore testuale: una chiave sbagliata non cancella le altre. */
function withCleanSocial(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const social = (raw as { social?: unknown }).social
  if (!social || typeof social !== 'object' || Array.isArray(social)) return raw
  const clean: Record<string, string> = {}
  for (const k of SOCIAL_KEYS) {
    const v = (social as Record<string, unknown>)[k]
    if (typeof v === 'string') clean[k] = v
  }
  return { ...raw, social: clean }
}

export function isProfileEmpty(p: CompanyProfile): boolean {
  return (
    !p.contacts.length &&
    !p.website &&
    !p.links.length &&
    !Object.values(p.social).some(Boolean) &&
    !p.address &&
    !p.vat &&
    !p.notes
  )
}

export function normUrl(u: string | undefined): string {
  const v = (u ?? '').trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

/** "@nomeprofilo" → URL completo del social; un link già completo resta com'è. */
export function socialUrl(key: SocialKey, value: string | undefined): string {
  const v = (value ?? '').trim()
  if (!v) return ''
  if (/^https?:\/\//i.test(v) || /\.(com|it|net)\//i.test(v)) return normUrl(v)
  const base = SOCIALS.find((s) => s.key === key)?.base ?? ''
  return base + v.replace(/^@/, '')
}

export interface QuickLink {
  label: string
  url: string
}

/** Sito + link utili della scheda, nell'ordine in cui compaiono nell'intestazione. */
export function quickLinks(p: CompanyProfile): QuickLink[] {
  const out: QuickLink[] = []
  if (p.website) out.push({ label: 'Sito', url: normUrl(p.website) })
  for (const l of p.links) if (l.url) out.push({ label: l.label || 'Link', url: normUrl(l.url) })
  return out
}

export function initials(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

export const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v)
