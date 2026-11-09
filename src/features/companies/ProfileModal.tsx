import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button, LinkButton } from '@/components/ui/Button'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useData } from '@/data/queries'
import { SOCIAL_KEYS, SOCIALS, type CompanyProfile } from '@/lib/profile'
import { closeModal } from '@/stores/modals'
import { useCompanyActions } from './actions'

const email = z
  .string()
  .trim()
  .refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), 'Email non valida')

const schema = z.object({
  contacts: z.array(z.object({ name: z.string(), role: z.string(), email, phone: z.string() })),
  website: z.string(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  social: z.object(
    Object.fromEntries(SOCIAL_KEYS.map((k) => [k, z.string()])) as Record<
      (typeof SOCIAL_KEYS)[number],
      z.ZodString
    >,
  ),
  address: z.string(),
  vat: z.string(),
  notes: z.string(),
})
type Values = z.infer<typeof schema>

const opt = (v: string) => (v.trim() ? v.trim() : undefined)

/** `prev`: i vecchi campi brand restano com'erano (il Setup aziendale li legge finché non viene salvato). */
function toProfile(v: Values, prev: CompanyProfile): CompanyProfile {
  const social: CompanyProfile['social'] = {}
  for (const k of SOCIAL_KEYS) if (v.social[k].trim()) social[k] = v.social[k].trim()
  return {
    contacts: v.contacts
      .filter((c) => c.name.trim() || c.email.trim() || c.phone.trim())
      .map((c) => ({ name: c.name.trim(), role: opt(c.role), email: opt(c.email), phone: opt(c.phone) })),
    website: opt(v.website),
    links: v.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    social,
    brandColors: prev.brandColors,
    fonts: prev.fonts,
    address: opt(v.address),
    vat: opt(v.vat),
    notes: v.notes.trim() ? v.notes : undefined,
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-line pb-3.5 last:border-b-0">
      <h4 className="m-0 text-[13px] tracking-[0.06em] text-accent uppercase">{title}</h4>
      {children}
    </section>
  )
}

function RemoveBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="hit-slop grid size-[26px] place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-danger [&_svg]:size-[15px]"
    >
      <X />
    </button>
  )
}

/** Modifica della scheda azienda (840px) con righe dinamiche per referenti e link. */
export function ProfileModal({ companyId }: { companyId: string }) {
  const view = useData()
  const { saveProfile } = useCompanyActions()
  const company = view.companyById.get(companyId)
  const p = company?.profile

  const { register, control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      contacts: (p?.contacts ?? []).map((c) => ({
        name: c.name,
        role: c.role ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
      })),
      website: p?.website ?? '',
      links: p?.links ?? [],
      social: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, p?.social[k] ?? ''])) as Values['social'],
      address: p?.address ?? '',
      vat: p?.vat ?? '',
      notes: p?.notes ?? '',
    },
  })
  const contacts = useFieldArray({ control, name: 'contacts' })
  const links = useFieldArray({ control, name: 'links' })

  if (!company) return null

  const submit = handleSubmit(
    (v) => {
      saveProfile(company.id, toProfile(v, company.profile))
      closeModal()
    },
    (errors) => {
      const msg = errors.contacts?.find?.((c) => c?.email)?.email?.message ?? 'Controlla i campi'
      toast(msg)
    },
  )

  return (
    <Modal title={`Scheda di ${company.name}`} size="wide" onClose={closeModal}>
      <form onSubmit={submit} noValidate autoComplete="off">
        <ModalBody>
          <Section title="Referenti">
            {contacts.fields.map((f, i) => (
              <div
                key={f.id}
                className="grid grid-cols-[1.2fr_1fr_1.3fr_1fr_26px] items-center gap-1.5 mobile:grid-cols-2"
              >
                <input
                  className="input"
                  aria-label="Nome e cognome"
                  placeholder="Nome e cognome"
                  {...register(`contacts.${i}.name`)}
                />
                <input
                  className="input"
                  aria-label="Ruolo"
                  placeholder="Ruolo"
                  {...register(`contacts.${i}.role`)}
                />
                <input
                  className="input"
                  aria-label="Email"
                  type="email"
                  placeholder="Email"
                  {...register(`contacts.${i}.email`)}
                />
                <input
                  className="input"
                  aria-label="Telefono"
                  type="tel"
                  placeholder="Telefono"
                  {...register(`contacts.${i}.phone`)}
                />
                <RemoveBtn label="Rimuovi referente" onClick={() => contacts.remove(i)} />
              </div>
            ))}
            <LinkButton
              className="self-start"
              onClick={() => contacts.append({ name: '', role: '', email: '', phone: '' })}
            >
              <Plus /> Aggiungi referente
            </LinkButton>
          </Section>

          <Section title="Sito e link utili">
            <div className="field">
              <label htmlFor="pf-site">Sito web</label>
              <input id="pf-site" className="input" placeholder="www.esempio.it" {...register('website')} />
            </div>
            {links.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_1.6fr_26px] items-center gap-1.5">
                <input
                  className="input"
                  aria-label="Nome del link"
                  placeholder="Nome (es. Drive, Canva, WP admin)"
                  {...register(`links.${i}.label`)}
                />
                <input
                  className="input"
                  aria-label="URL"
                  placeholder="https://"
                  {...register(`links.${i}.url`)}
                />
                <RemoveBtn label="Rimuovi link" onClick={() => links.remove(i)} />
              </div>
            ))}
            <LinkButton className="self-start" onClick={() => links.append({ label: '', url: '' })}>
              <Plus /> Aggiungi link
            </LinkButton>
            <p className="m-0 mt-1 text-xs text-ink-3">
              Niente password qui: per quelle usa un password manager.
            </p>
          </Section>

          <Section title="Social">
            <div className="grid grid-cols-2 gap-3 mobile:grid-cols-1">
              {SOCIALS.map((s) => (
                <div key={s.key} className="field">
                  <label htmlFor={`pf-${s.key}`}>{s.label}</label>
                  <input
                    id={`pf-${s.key}`}
                    className="input"
                    placeholder="@nomeprofilo o link"
                    {...register(`social.${s.key}`)}
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Dati aziendali">
            <div className="grid grid-cols-2 gap-3 mobile:grid-cols-1">
              <div className="field">
                <label htmlFor="pf-addr">Indirizzo</label>
                <input
                  id="pf-addr"
                  className="input"
                  autoComplete="street-address"
                  {...register('address')}
                />
              </div>
              <div className="field">
                <label htmlFor="pf-vat">P.IVA / Codice fiscale</label>
                <input id="pf-vat" className="input num" {...register('vat')} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="pf-notes">Note</label>
              <textarea
                id="pf-notes"
                className="input"
                placeholder="Orari, preferenze del cliente, tono di voce, cose da ricordare…"
                {...register('notes')}
              />
            </div>
          </Section>
        </ModalBody>
        <ModalFooter>
          <span className="flex-1" />
          <Button onClick={closeModal}>Annulla</Button>
          <Button type="submit" variant="primary">
            Salva scheda
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
