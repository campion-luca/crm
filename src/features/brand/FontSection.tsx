import { Copy, Download, ExternalLink, Pencil, Plus, Trash2, Type, Upload, X } from 'lucide-react'
import { memo, useState } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { Module } from '@/components/ui/Module'
import { Skeleton } from '@/components/ui/Skeleton'
import { FONT_ACCEPT, fontRoleLabel, isGoogleFontsUrl, type BrandFont, type CompanyBrand } from '@/lib/brand'
import { copyText } from '@/lib/hooks'
import { normUrl } from '@/lib/profile'
import { openModal } from '@/stores/modals'
import { FONT_STATUS_TEXT, useFontPreview } from './fontPreview'
import { DropArea, DropTile, FileButton, RoleTag } from './parts'
import type { BrandActions } from './useBrand'

const PANGRAM = 'Quel vituperabile xenofobo zelante assaggia il whisky ed esclama: alleluja!'
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 àèéìòù € & @'

function linkLabel(url: string): string {
  if (isGoogleFontsUrl(url)) return 'Google Fonts'
  if (/fonts\.adobe\.com/i.test(url)) return 'Adobe Fonts'
  try {
    return new URL(normUrl(url)).hostname.replace(/^www\./, '')
  } catch {
    return 'Link'
  }
}

/** Font del brand con anteprima vera (file caricato, Google Fonts o font installato). */
export function FontSection({
  brand,
  companyId,
  actions,
}: {
  brand: CompanyBrand
  companyId: string
  actions: BrandActions
}) {
  const [busy, setBusy] = useState(0)
  const upload = async (files: File[]) => {
    setBusy((n) => n + 1)
    try {
      await actions.addFontFiles(files)
    } finally {
      setBusy((n) => n - 1)
    }
  }
  const add = () => openModal({ kind: 'brandFont', companyId })

  return (
    <DropArea onFiles={(f) => void upload(f)}>
      {(over) => (
        <Module
          title="Font"
          icon={<Type />}
          iconTone="company"
          count={brand.fonts.length || undefined}
          right={
            <>
              <FileButton size="sm" accept={FONT_ACCEPT} onFiles={(f) => void upload(f)}>
                <Upload /> File
              </FileButton>
              <Button size="sm" onClick={add}>
                <Plus /> Font
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 p-4">
            {brand.fonts.map((f) => (
              <FontCard key={f.id} font={f} companyId={companyId} actions={actions} />
            ))}
            {busy > 0 && (
              <div className="flex gap-3.5 rounded-card border border-line p-4" aria-hidden>
                <Skeleton className="size-12" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-52" />
                </div>
              </div>
            )}
            <DropTile
              accept={FONT_ACCEPT}
              onFiles={(f) => void upload(f)}
              over={over}
              className={brand.fonts.length ? 'py-4' : 'py-8'}
              title={brand.fonts.length ? 'Carica altri file dei font' : 'Carica i file dei font'}
              hint="WOFF2, WOFF, TTF o OTF: nome e stile si leggono dal file. Per un Google Font basta il link: usa “+ Font”."
            />
          </div>
        </Module>
      )}
    </DropArea>
  )
}

const FontCard = memo(function FontCard({
  font,
  companyId,
  actions,
}: {
  font: BrandFont
  companyId: string
  actions: BrandActions
}) {
  const { fontFamily, status } = useFontPreview(font)
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface-2 py-3.5 pr-2 pl-4">
      <div className="flex flex-wrap items-start gap-3.5 mobile:gap-x-3 mobile:gap-y-1">
        <span
          aria-hidden
          style={{ fontFamily }}
          className="w-[62px] shrink-0 pt-0.5 text-[44px] leading-none text-ink"
        >
          Aa
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="m-0 truncate text-[15px] font-bold">{font.family}</h4>
            <RoleTag>{fontRoleLabel(font.role)}</RoleTag>
          </div>
          {font.weights && <span className="text-xs text-ink-2">{font.weights}</span>}
          {status ? (
            <span className="text-[11.5px] text-pretty text-ink-3">{FONT_STATUS_TEXT[status]}</span>
          ) : (
            <Skeleton className="mt-1 h-3 w-40" />
          )}
        </div>
        <div className="flex shrink-0 mobile:-mt-1 mobile:w-full mobile:justify-end">
          <IconButton
            aria-label={`Copia il nome ${font.family}`}
            title="Copia il nome"
            onClick={() => void copyText(font.family)}
          >
            <Copy />
          </IconButton>
          <FileButton
            icon
            accept={FONT_ACCEPT}
            onFiles={(f) => void actions.addFontFiles(f, font.id)}
            aria-label={`Carica file per ${font.family}`}
            title="Carica file del font"
          >
            <Upload />
          </FileButton>
          <IconButton
            aria-label={`Modifica ${font.family}`}
            title="Modifica"
            onClick={() => openModal({ kind: 'brandFont', companyId, fontId: font.id })}
          >
            <Pencil />
          </IconButton>
          <IconButton
            aria-label={`Elimina ${font.family}`}
            title="Elimina"
            onClick={() => actions.removeFont(font.id)}
            className="hover:text-danger"
          >
            <Trash2 />
          </IconButton>
        </div>
      </div>
      <div className="flex flex-col gap-1 pr-2" style={{ fontFamily }}>
        <p className="m-0 text-[19px] leading-snug text-ink">{PANGRAM}</p>
        <p className="m-0 text-[13px] leading-snug break-words text-ink-3">{GLYPHS}</p>
      </div>
      {(font.files.length > 0 || font.url) && (
        <div className="flex flex-wrap items-center gap-1.5 pr-2">
          {font.files.map((f) => (
            <span
              key={f.path}
              className="inline-flex items-center rounded-full border border-line bg-surface text-xs text-ink-2"
            >
              <button
                type="button"
                title={`Scarica ${f.name}`}
                onClick={() => void actions.download(f)}
                className="inline-flex items-center gap-1 py-1 pr-1 pl-2.5 hover:text-accent [&_svg]:size-3"
              >
                <Download aria-hidden />
                {f.style ?? f.name}
              </button>
              <button
                type="button"
                aria-label={`Elimina ${f.name}`}
                title="Elimina il file"
                onClick={() => actions.removeFontFile(font.id, f.path)}
                className="grid size-6 place-items-center rounded-full text-ink-3 hover:text-danger [&_svg]:size-3"
              >
                <X />
              </button>
            </span>
          ))}
          {font.url && (
            <a
              href={normUrl(font.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft [&_svg]:size-3"
            >
              <ExternalLink aria-hidden />
              {linkLabel(font.url)}
            </a>
          )}
        </div>
      )}
    </article>
  )
})
