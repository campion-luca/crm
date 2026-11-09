import {
  ArrowRight,
  AtSign,
  Copy,
  Droplet,
  FileText,
  Globe,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  User,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, LinkButton } from '@/components/ui/Button'
import { isBrandEmpty } from '@/lib/brand'
import { EmptyState, Module } from '@/components/ui/Module'
import { copyText } from '@/lib/hooks'
import { isProfileEmpty, normUrl, SOCIALS, socialUrl } from '@/lib/profile'
import type { Company } from '@/lib/types'
import { openModal } from '@/stores/modals'
import { Avatar } from './CompanyCard'

function CopyBtn({ value }: { value: string }) {
  return (
    <button
      type="button"
      title="Copia"
      aria-label={`Copia ${value}`}
      onClick={() => void copyText(value)}
      className="hit-slop grid size-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-accent [&_svg]:size-[13px]"
    >
      <Copy />
    </button>
  )
}

function KV({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-[13px] text-ink-2 [&>svg]:size-[15px] [&>svg]:shrink-0 [&>svg]:text-ink-3">
      {icon}
      {children}
    </div>
  )
}

function PLink({ href, icon, title, sub }: { href: string; icon: ReactNode; title: string; sub: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-0 items-center gap-2.5 rounded-[10px] bg-surface-2 px-2.5 py-2 text-ink no-underline hover:shadow-[inset_0_0_0_1px_var(--accent)] [&>svg]:size-[15px] [&>svg]:shrink-0 [&>svg]:text-(--c)"
    >
      {icon}
      <span className="flex min-w-0 flex-col">
        <b className="font-semibold">{title}</b>
        <span className="truncate text-xs text-ink-3">{sub}</span>
      </span>
    </a>
  )
}

const none = <span className="text-xs text-ink-3">Non compilato</span>

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Module title={title} icon={icon} iconTone="company">
      <div className="flex flex-col gap-2.5 px-[18px] pt-3.5 pb-4">{children}</div>
    </Module>
  )
}

/** Riepilogo del Setup aziendale nella scheda: colori e font, con il link al tab completo. */
function BrandSummary({ company, onSetup }: { company: Company; onSetup: () => void }) {
  const b = company.brand
  return (
    <Card title="Brand" icon={<Droplet />}>
      {isBrandEmpty(b) ? (
        <span className="text-xs text-ink-3">
          Logo, colori, font e tono di voce stanno nel Setup aziendale.
        </span>
      ) : (
        <>
          {b.colors.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {b.colors.slice(0, 10).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={`Copia ${c.hex.toUpperCase()}${c.name ? ` · ${c.name}` : ''}`}
                  aria-label={`Copia ${c.hex.toUpperCase()}`}
                  onClick={() => void copyText(c.hex.toUpperCase())}
                  className="hit-slop size-7 rounded-lg border border-white/10"
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          )}
          <span className="text-[13px] text-ink-2">
            {[
              b.logos.length ? `${b.logos.length} ${b.logos.length === 1 ? 'logo' : 'loghi'}` : '',
              b.fonts.map((f) => f.family).join(', '),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </>
      )}
      <LinkButton className="self-start" onClick={onSetup}>
        Apri il Setup aziendale <ArrowRight />
      </LinkButton>
    </Card>
  )
}

/** Tab "Scheda azienda": referenti, link utili, social, dati e note. Click per copiare. */
export function CompanyProfileView({ company, onSetup }: { company: Company; onSetup: () => void }) {
  const p = company.profile
  const edit = () => openModal({ kind: 'profile', companyId: company.id })

  if (isProfileEmpty(p)) {
    return (
      <Module>
        <EmptyState title={`La scheda di ${company.name} è vuota`} className="px-5 py-11">
          Aggiungi referenti, link utili, social e dati aziendali: li ritrovi qui senza cercarli tra mille
          tab. Logo, colori e font stanno nel Setup aziendale.
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={edit}>
              <Plus /> Compila la scheda
            </Button>
            <Button onClick={onSetup}>Apri il Setup aziendale</Button>
          </div>
        </EmptyState>
      </Module>
    )
  }

  const socials = SOCIALS.filter((s) => p.social[s.key])

  return (
    <>
      <div className="flex items-center justify-between gap-2.5">
        <span className="text-xs text-ink-3">Clicca un colore, un&apos;email o un numero per copiarlo.</span>
        <Button onClick={edit}>Modifica scheda</Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] items-start gap-4 mobile:grid-cols-1">
        <Card title="Referenti" icon={<User />}>
          {p.contacts.length
            ? p.contacts.map((k, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 border-b border-dashed border-line pb-2.5 last:border-b-0 last:pb-0"
                >
                  <Avatar name={k.name || '?'} size="sm" />
                  <div className="flex min-w-0 flex-col gap-[3px]">
                    <b>{k.name || 'Senza nome'}</b>
                    {k.role && <span className="text-xs text-ink-3">{k.role}</span>}
                    {k.email && (
                      <KV icon={<Mail aria-hidden />}>
                        <a href={`mailto:${k.email}`} className="truncate text-ink hover:text-accent">
                          {k.email}
                        </a>
                        <CopyBtn value={k.email} />
                      </KV>
                    )}
                    {k.phone && (
                      <KV icon={<Phone aria-hidden />}>
                        <span className="num">{k.phone}</span>
                        <CopyBtn value={k.phone} />
                      </KV>
                    )}
                  </div>
                </div>
              ))
            : none}
        </Card>

        <Card title="Link utili" icon={<Link2 />}>
          {p.website || p.links.length ? (
            <>
              {p.website && (
                <PLink
                  href={normUrl(p.website)}
                  icon={<Globe aria-hidden />}
                  title="Sito web"
                  sub={p.website}
                />
              )}
              {p.links
                .filter((l) => l.url)
                .map((l, i) => (
                  <PLink
                    key={i}
                    href={normUrl(l.url)}
                    icon={<Link2 aria-hidden />}
                    title={l.label || 'Link'}
                    sub={l.url}
                  />
                ))}
            </>
          ) : (
            none
          )}
        </Card>

        <Card title="Social" icon={<AtSign />}>
          {socials.length
            ? socials.map((s) => (
                <PLink
                  key={s.key}
                  href={socialUrl(s.key, p.social[s.key])}
                  icon={<AtSign aria-hidden />}
                  title={s.label}
                  sub={p.social[s.key] ?? ''}
                />
              ))
            : none}
        </Card>

        <BrandSummary company={company} onSetup={onSetup} />

        <Card title="Dati aziendali e note" icon={<FileText />}>
          {!p.address && !p.vat && !p.notes && none}
          {p.address && (
            <KV icon={<MapPin aria-hidden />}>
              <span>{p.address}</span>
              <CopyBtn value={p.address} />
            </KV>
          )}
          {p.vat && (
            <KV icon={<FileText aria-hidden />}>
              <span>
                P.IVA / CF <b className="num">{p.vat}</b>
              </span>
              <CopyBtn value={p.vat} />
            </KV>
          )}
          {p.notes && (
            <div className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[13px] leading-[1.55] whitespace-pre-line text-ink-2">
              {p.notes}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
