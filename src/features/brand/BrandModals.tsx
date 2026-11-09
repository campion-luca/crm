import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'
import { useData } from '@/data/queries'
import { COLOR_ROLES, FONT_ROLES, isGoogleFontsUrl, type ColorRole, type FontRole } from '@/lib/brand'
import { newId } from '@/lib/format'
import { isHex } from '@/lib/profile'
import { closeModal } from '@/stores/modals'
import { useBrandActions } from './useBrand'

const opt = (v: string) => (v.trim() ? v.trim() : undefined)
const firstError = (e: Record<string, { message?: string } | undefined>) =>
  Object.values(e).find((x) => x?.message)?.message ?? 'Controlla i campi'

// ------------------------------------------------------------------ colore

const colorSchema = z.object({
  name: z.string().max(60, 'Nome troppo lungo'),
  hex: z
    .string()
    .trim()
    .transform((v) => (v.startsWith('#') ? v : `#${v}`))
    .refine(isHex, 'Colore non valido: usa il formato #rrggbb'),
  role: z.enum(COLOR_ROLES.map((r) => r.id) as [ColorRole, ...ColorRole[]]),
  note: z.string().max(120),
  asApp: z.boolean(),
})
type ColorValues = z.input<typeof colorSchema>

export function BrandColorModal({ companyId, colorId }: { companyId: string; colorId?: string }) {
  const view = useData()
  const { saveColor } = useBrandActions(companyId)
  const company = view.companyById.get(companyId)
  const color = colorId ? company?.brand.colors.find((c) => c.id === colorId) : undefined
  const { register, control, handleSubmit, setValue } = useForm<
    ColorValues,
    unknown,
    z.output<typeof colorSchema>
  >({
    resolver: zodResolver(colorSchema),
    defaultValues: {
      name: color?.name ?? '',
      hex: color?.hex ?? '#ff6eb4',
      role: color?.role ?? (company?.brand.colors.length ? 'secondary' : 'primary'),
      note: color?.note ?? '',
      asApp: false,
    },
  })
  const hex = useWatch({ control, name: 'hex' })
  if (!company) return null

  const submit = handleSubmit(
    (v) => {
      saveColor(
        {
          id: color?.id ?? newId(),
          name: v.name.trim(),
          hex: v.hex.toLowerCase(),
          role: v.role,
          note: opt(v.note),
        },
        v.asApp,
      )
      closeModal()
    },
    (e) => toast(firstError(e)),
  )

  return (
    <Modal title={color ? 'Modifica colore' : 'Nuovo colore'} size="sm" onClose={closeModal}>
      <form onSubmit={submit} noValidate autoComplete="off">
        <ModalBody>
          <div className="field">
            <label htmlFor="bc-name">Nome</label>
            <input
              id="bc-name"
              autoFocus
              className="input"
              placeholder="es. Giallo semola"
              {...register('name')}
            />
          </div>
          <div className="field">
            <label htmlFor="bc-hex">Colore</label>
            <div className="grid grid-cols-[52px_1fr] gap-2">
              <input
                type="color"
                aria-label="Scegli colore"
                value={isHex(hex) ? hex : '#000000'}
                onChange={(e) => setValue('hex', e.target.value, { shouldDirty: true })}
                className="h-[38px] w-full cursor-pointer rounded-lg border border-line bg-surface p-0.5"
              />
              <input id="bc-hex" className="input num" placeholder="#000000" {...register('hex')} />
            </div>
          </div>
          <div className="field">
            <span className="field-label">Ruolo</span>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Segmented
                  label="Ruolo del colore"
                  value={field.value}
                  onChange={field.onChange}
                  options={COLOR_ROLES.map((r) => ({ value: r.id, label: r.label }))}
                />
              )}
            />
          </div>
          <div className="field">
            <label htmlFor="bc-note">Pantone, CMYK o note</label>
            <input
              id="bc-note"
              className="input"
              placeholder="es. Pantone 7403 C · C0 M10 Y55 K0"
              {...register('note')}
            />
          </div>
          {hex.toLowerCase() !== company.color.toLowerCase() && (
            <Controller
              control={control}
              name="asApp"
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-2">
                  <Checkbox
                    checked={field.value}
                    onChange={() => field.onChange(!field.value)}
                    label="Usa come colore dell’azienda nell’app"
                  />
                  Usa come colore dell’azienda nell’app (calendario, card, filtri)
                </label>
              )}
            />
          )}
        </ModalBody>
        <ModalFooter>
          <span className="flex-1" />
          <Button onClick={closeModal}>Annulla</Button>
          <Button type="submit" variant="primary">
            {color ? 'Salva' : 'Aggiungi colore'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

// ------------------------------------------------------------------ font

const fontSchema = z.object({
  family: z.string().trim().min(1, 'Scrivi il nome del font').max(80, 'Nome troppo lungo'),
  role: z.enum(FONT_ROLES.map((r) => r.id) as [FontRole, ...FontRole[]]),
  weights: z.string().max(120),
  url: z.string().max(500),
})
type FontValues = z.infer<typeof fontSchema>

export function BrandFontModal({ companyId, fontId }: { companyId: string; fontId?: string }) {
  const view = useData()
  const { saveFont } = useBrandActions(companyId)
  const company = view.companyById.get(companyId)
  const font = fontId ? company?.brand.fonts.find((f) => f.id === fontId) : undefined
  const used = new Set(company?.brand.fonts.map((f) => f.role))
  const { register, control, handleSubmit } = useForm<FontValues>({
    resolver: zodResolver(fontSchema),
    defaultValues: {
      family: font?.family ?? '',
      role: font?.role ?? (!used.has('heading') ? 'heading' : !used.has('body') ? 'body' : 'other'),
      weights: font?.weights ?? '',
      url: font?.url ?? '',
    },
  })
  const url = useWatch({ control, name: 'url' })
  if (!company) return null

  const submit = handleSubmit(
    (v) => {
      saveFont({
        id: font?.id ?? newId(),
        family: v.family,
        role: v.role,
        weights: opt(v.weights),
        url: opt(v.url),
      })
      closeModal()
    },
    (e) => toast(firstError(e)),
  )

  return (
    <Modal title={font ? `Modifica ${font.family}` : 'Nuovo font'} size="sm" onClose={closeModal}>
      <form onSubmit={submit} noValidate autoComplete="off">
        <ModalBody>
          <div className="field">
            <label htmlFor="bf-family">Nome del font</label>
            <input
              id="bf-family"
              autoFocus
              className="input"
              placeholder="es. Playfair Display"
              {...register('family')}
            />
          </div>
          <div className="field">
            <span className="field-label">Uso</span>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Segmented
                  label="Uso del font"
                  value={field.value}
                  onChange={field.onChange}
                  options={FONT_ROLES.map((r) => ({ value: r.id, label: r.label }))}
                />
              )}
            />
          </div>
          <div className="field">
            <label htmlFor="bf-weights">Pesi e stili</label>
            <input
              id="bf-weights"
              className="input"
              placeholder="es. Regular, SemiBold, Bold"
              {...register('weights')}
            />
          </div>
          <div className="field">
            <label htmlFor="bf-url">Link</label>
            <input
              id="bf-url"
              className="input"
              placeholder="https://fonts.google.com/specimen/…"
              {...register('url')}
            />
            <span className="text-xs text-pretty text-ink-3">
              {isGoogleFontsUrl(url)
                ? 'Link a Google Fonts: l’anteprima userà il font vero.'
                : 'Google Fonts, Adobe Fonts o la pagina da cui scaricarlo. Con un link a Google Fonts l’anteprima usa il font vero.'}
            </span>
          </div>
          {!font && (
            <p className="m-0 text-xs text-pretty text-ink-3">
              Hai i file (.woff2, .ttf, .otf)? Trascinali nella sezione Font: nome e stile si leggono dal
              file.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <span className="flex-1" />
          <Button onClick={closeModal}>Annulla</Button>
          <Button type="submit" variant="primary">
            {font ? 'Salva' : 'Aggiungi font'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

// ------------------------------------------------------------------ tono e linee guida

const guideSchema = z.object({
  payoff: z.string().max(200, 'Payoff troppo lungo'),
  tone: z.string().max(4000),
  hashtags: z.string().max(1000),
  guidelines: z.string().max(8000),
})
type GuideValues = z.infer<typeof guideSchema>

export function BrandGuideModal({ companyId }: { companyId: string }) {
  const view = useData()
  const { saveGuide } = useBrandActions(companyId)
  const company = view.companyById.get(companyId)
  const b = company?.brand
  const { register, handleSubmit } = useForm<GuideValues>({
    resolver: zodResolver(guideSchema),
    defaultValues: {
      payoff: b?.payoff ?? '',
      tone: b?.tone ?? '',
      hashtags: b?.hashtags ?? '',
      guidelines: b?.guidelines ?? '',
    },
  })
  if (!company) return null

  const submit = handleSubmit(
    (v) => {
      saveGuide({
        payoff: opt(v.payoff),
        tone: opt(v.tone),
        hashtags: opt(v.hashtags),
        guidelines: opt(v.guidelines),
      })
      closeModal()
    },
    (e) => toast(firstError(e)),
  )

  return (
    <Modal title={`Tono e linee guida · ${company.name}`} size="md" onClose={closeModal}>
      <form onSubmit={submit} noValidate autoComplete="off">
        <ModalBody>
          <div className="field">
            <label htmlFor="bg-payoff">Payoff</label>
            <input
              id="bg-payoff"
              autoFocus
              className="input"
              placeholder="Lo slogan del brand"
              {...register('payoff')}
            />
          </div>
          <div className="field">
            <label htmlFor="bg-tone">Tono di voce</label>
            <textarea
              id="bg-tone"
              className="input min-h-[88px]"
              placeholder="es. Caldo e diretto, diamo del tu, frasi brevi, niente inglesismi"
              {...register('tone')}
            />
          </div>
          <div className="field">
            <label htmlFor="bg-tags">Hashtag</label>
            <input id="bg-tags" className="input" placeholder="#brand #campagna" {...register('hashtags')} />
          </div>
          <div className="field">
            <label htmlFor="bg-guide">Linee guida</label>
            <textarea
              id="bg-guide"
              className="input min-h-[110px]"
              placeholder="Uso del logo (area di rispetto, dimensione minima, fondi), stile foto, cose da evitare…"
              {...register('guidelines')}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <span className="flex-1" />
          <Button onClick={closeModal}>Annulla</Button>
          <Button type="submit" variant="primary">
            Salva
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

// ------------------------------------------------------------------ link

const linkSchema = z.object({
  label: z.string().max(80, 'Nome troppo lungo'),
  url: z
    .string()
    .trim()
    .min(1, 'Incolla il link')
    .refine((v) => /^(https?:\/\/)?[^\s/$.?#]+\.[^\s]+$/i.test(v), 'Link non valido'),
})
type LinkValues = z.infer<typeof linkSchema>

export function BrandLinkModal({ companyId, docId }: { companyId: string; docId?: string }) {
  const view = useData()
  const { saveDoc } = useBrandActions(companyId)
  const company = view.companyById.get(companyId)
  const doc = docId ? company?.brand.docs.find((d) => d.id === docId) : undefined
  const { register, handleSubmit } = useForm<LinkValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: { label: doc?.label ?? '', url: doc?.url ?? '' },
  })
  if (!company) return null

  const submit = handleSubmit(
    (v) => {
      saveDoc({ id: doc?.id ?? newId(), label: v.label.trim(), url: v.url, file: undefined })
      closeModal()
    },
    (e) => toast(firstError(e)),
  )

  return (
    <Modal title={doc ? 'Modifica link' : 'Nuovo link'} size="sm" onClose={closeModal}>
      <form onSubmit={submit} noValidate autoComplete="off">
        <ModalBody>
          <div className="field">
            <label htmlFor="bl-url">Link</label>
            <input id="bl-url" autoFocus className="input" placeholder="https://" {...register('url')} />
          </div>
          <div className="field">
            <label htmlFor="bl-label">Nome</label>
            <input
              id="bl-label"
              className="input"
              placeholder="es. Brand book su Drive, Kit Canva, File Figma"
              {...register('label')}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <span className="flex-1" />
          <Button onClick={closeModal}>Annulla</Button>
          <Button type="submit" variant="primary">
            {doc ? 'Salva' : 'Aggiungi link'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
