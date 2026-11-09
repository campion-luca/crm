import { CircleUserRound, Download, Moon, Shapes, Sun, Trash2, Upload } from 'lucide-react'
import { memo, useState } from 'react'
import { IconButton } from '@/components/ui/Button'
import { Module } from '@/components/ui/Module'
import { Skeleton } from '@/components/ui/Skeleton'
import { fileExt, fmtBytes, LOGO_ACCEPT, type BrandLogo, type CompanyBrand } from '@/lib/brand'
import { cn } from '@/lib/format'
import { LOGO_BG } from './image'
import { DropArea, DropTile, FileButton, InlineEdit } from './parts'
import { useFileUrl, type BrandActions } from './useBrand'

/** Loghi e varianti: anteprima sul fondo giusto, download, avatar dell'azienda. */
export function LogoSection({
  brand,
  companyName,
  actions,
}: {
  brand: CompanyBrand
  companyName: string
  actions: BrandActions
}) {
  const [busy, setBusy] = useState(0)
  const avatarLogo = brand.logos.find((l) => l.id === brand.avatarOf)
  const wideAvatar = !!avatarLogo?.w && !!avatarLogo.h && avatarLogo.w / avatarLogo.h > 2.2
  const upload = async (files: File[]) => {
    setBusy((n) => n + files.length)
    try {
      await actions.uploadLogos(files)
    } finally {
      setBusy((n) => n - files.length)
    }
  }

  return (
    <DropArea onFiles={(f) => void upload(f)}>
      {(over) => (
        <Module
          title="Logo"
          icon={<Shapes />}
          iconTone="company"
          count={brand.logos.length ? `${brand.logos.length} file` : undefined}
          right={
            <FileButton size="sm" accept={LOGO_ACCEPT} onFiles={(f) => void upload(f)}>
              <Upload /> Carica logo
            </FileButton>
          }
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3 p-4">
            {brand.logos.map((l) => (
              <LogoTile
                key={l.id}
                logo={l}
                isAvatar={brand.avatarOf === l.id}
                companyName={companyName}
                actions={actions}
              />
            ))}
            {Array.from({ length: busy }, (_, i) => (
              <div
                key={i}
                className="flex flex-col overflow-hidden rounded-card border border-line"
                aria-hidden
              >
                <Skeleton className="h-[150px] rounded-none" />
                <div className="flex flex-col gap-1.5 px-3 py-2.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
            <DropTile
              accept={LOGO_ACCEPT}
              onFiles={(f) => void upload(f)}
              over={over}
              className="min-h-[204px]"
              title={brand.logos.length ? 'Aggiungi una variante' : 'Carica il logo'}
              hint={
                brand.logos.length
                  ? 'Negativo, pittogramma, orizzontale… SVG, PNG, JPG o WebP'
                  : 'Trascinalo qui o clicca. SVG, PNG, JPG o WebP: il primo logo diventa l’avatar dell’azienda.'
              }
            />
          </div>
          {wideAvatar && (
            <p className="m-0 border-t border-line px-[18px] py-2.5 text-xs text-pretty text-ink-3">
              L’avatar usa un logo molto largo e in piccolo si legge poco: se hai il pittogramma (la versione
              quadrata), caricalo e scegli “Usa come avatar”.
            </p>
          )}
        </Module>
      )}
    </DropArea>
  )
}

const LogoTile = memo(function LogoTile({
  logo,
  isAvatar,
  companyName,
  actions,
}: {
  logo: BrandLogo
  isAvatar: boolean
  companyName: string
  actions: BrandActions
}) {
  const { data: url, isError } = useFileUrl(logo.file.path)
  const [loaded, setLoaded] = useState(false)
  const dark = logo.bg === 'dark'
  const meta = [
    fileExt(logo.file.name).toUpperCase() || 'File',
    logo.w && logo.h ? `${logo.w}×${logo.h}` : null,
    fmtBytes(logo.file.size),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <figure className="m-0 flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface-2">
      <div
        className="relative grid h-[150px] place-items-center p-6"
        style={{ background: LOGO_BG[logo.bg] }}
      >
        {url && !isError && (
          <img
            src={url}
            alt={`${logo.label} di ${companyName}`}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
            className={cn(
              'max-h-full max-w-full object-contain transition-opacity duration-200',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
          />
        )}
        {!loaded && !isError && (
          <span
            aria-hidden
            className={cn(
              'absolute inset-x-12 top-1/2 h-9 -translate-y-1/2 animate-pulse rounded-lg',
              dark ? 'bg-white/10' : 'bg-black/[.07]',
            )}
          />
        )}
        {isError && (
          <span className={cn('text-xs', dark ? 'text-white/60' : 'text-black/50')}>
            Anteprima non disponibile
          </span>
        )}
        {isAvatar && (
          <span className="absolute top-2 left-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white">
            Avatar
          </span>
        )}
      </div>
      <figcaption className="flex flex-col pt-1.5 pr-1.5 pb-2.5 pl-3">
        <div className="flex min-w-0 items-center gap-0.5">
          <div className="flex min-w-0 flex-1">
            <InlineEdit
              value={logo.label}
              label="Nome del logo"
              onSave={(v) => actions.renameLogo(logo.id, v)}
              className="text-[13.5px] font-semibold"
            />
          </div>
          <IconButton
            aria-label={`Scarica ${logo.label}`}
            title="Scarica"
            onClick={() => void actions.download(logo.file)}
          >
            <Download />
          </IconButton>
          <IconButton
            aria-label={dark ? 'Mostra su fondo chiaro' : 'Mostra su fondo scuro (logo in negativo)'}
            title={dark ? 'Fondo chiaro' : 'Fondo scuro'}
            onClick={() => void actions.setLogoBg(logo.id, dark ? 'light' : 'dark')}
          >
            {dark ? <Sun /> : <Moon />}
          </IconButton>
          <IconButton
            aria-pressed={isAvatar}
            aria-label={isAvatar ? 'Togli come avatar dell’azienda' : 'Usa come avatar dell’azienda'}
            title={isAvatar ? 'È l’avatar dell’azienda: clicca per tornare alle iniziali' : 'Usa come avatar'}
            onClick={() => void actions.setAvatar(isAvatar ? null : logo.id)}
            className={isAvatar ? 'text-accent' : undefined}
          >
            <CircleUserRound />
          </IconButton>
          <IconButton
            aria-label={`Elimina ${logo.label}`}
            title="Elimina"
            onClick={() => actions.removeLogo(logo.id)}
            className="hover:text-danger"
          >
            <Trash2 />
          </IconButton>
        </div>
        <span className="truncate num text-[11.5px] text-ink-3">{meta}</span>
      </figcaption>
    </figure>
  )
})
