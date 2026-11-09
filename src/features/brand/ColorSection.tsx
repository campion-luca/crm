import { Palette, Pencil, Plus, Trash2 } from 'lucide-react'
import { memo } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, Module } from '@/components/ui/Module'
import { colorRoleLabel, rgbText, textOn, type BrandColor, type CompanyBrand } from '@/lib/brand'
import { copyText } from '@/lib/hooks'
import { openModal } from '@/stores/modals'
import { CopyRow, RoleTag } from './parts'
import type { BrandActions } from './useBrand'

const ratioText = (r: number) => `${r.toFixed(1).replace('.', ',')}:1`

/** Palette: clic sul colore per copiare l'HEX, contrasto del testo già calcolato. */
export function ColorSection({
  brand,
  companyId,
  appColor,
  actions,
}: {
  brand: CompanyBrand
  companyId: string
  appColor: string
  actions: BrandActions
}) {
  const add = () => openModal({ kind: 'brandColor', companyId })
  return (
    <Module
      title="Colori"
      icon={<Palette />}
      iconTone="company"
      count={brand.colors.length || undefined}
      right={
        brand.colors.length > 0 && (
          <Button size="sm" onClick={add}>
            <Plus /> Colore
          </Button>
        )
      }
    >
      {brand.colors.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-4">
          {brand.colors.map((c) => (
            <ColorTile
              key={c.id}
              color={c}
              isApp={c.hex === appColor.toLowerCase()}
              onEdit={() => openModal({ kind: 'brandColor', companyId, colorId: c.id })}
              onRemove={() => actions.removeColor(c.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Nessun colore">
          Aggiungi la palette del brand: HEX e RGB a portata di clic, con il contrasto del testo già
          calcolato.
          <div className="mt-4">
            <Button variant="primary" onClick={add}>
              <Plus /> Aggiungi colore
            </Button>
          </div>
        </EmptyState>
      )}
    </Module>
  )
}

const ColorTile = memo(function ColorTile({
  color,
  isApp,
  onEdit,
  onRemove,
}: {
  color: BrandColor
  isApp: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const t = textOn(color.hex)
  const hex = color.hex.toUpperCase()
  const name = color.name || colorRoleLabel(color.role)
  const inkName = t.ink === '#ffffff' ? 'bianco' : 'nero'
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface-2">
      <button
        type="button"
        onClick={() => void copyText(hex)}
        aria-label={`Copia ${hex} (${name})`}
        title="Clicca per copiare l’HEX"
        className="relative h-[96px] text-left"
        style={{ background: color.hex, color: t.ink }}
      >
        <span aria-hidden className="absolute top-2.5 left-3 text-[26px] leading-none font-extrabold">
          Aa
        </span>
        <span
          className="absolute bottom-2 left-3 num text-[11px] font-semibold opacity-85"
          title={`Testo ${inkName} su questo colore: contrasto ${ratioText(t.ratio)} (${t.level})`}
        >
          {ratioText(t.ratio)} · {t.level}
        </span>
        {isApp && (
          <span
            className="absolute top-2 right-2 rounded-full px-1.5 py-px text-[10.5px] font-bold"
            style={{ background: t.ink, color: color.hex }}
            title="È il colore dell’azienda nell’app (calendario, card, filtri)"
          >
            App
          </span>
        )}
      </button>
      <div className="flex flex-col pt-2.5 pr-1 pb-2.5 pl-3">
        <b className="truncate pr-2 text-[13px]" title={name}>
          {name}
        </b>
        <div className="-mt-0.5 mb-0.5 flex min-w-0 items-center">
          <span className="min-w-0 flex-1 truncate">
            {color.name && <RoleTag>{colorRoleLabel(color.role)}</RoleTag>}
          </span>
          <IconButton aria-label={`Modifica ${name}`} title="Modifica" onClick={onEdit}>
            <Pencil />
          </IconButton>
          <IconButton
            aria-label={`Elimina ${name}`}
            title="Elimina"
            onClick={onRemove}
            className="hover:text-danger"
          >
            <Trash2 />
          </IconButton>
        </div>
        <div className="flex flex-col pr-2">
          <CopyRow label="HEX" value={hex} />
          <CopyRow label="RGB" value={rgbText(color.hex)} />
          {color.note && <CopyRow label="Nota" value={color.note} />}
        </div>
      </div>
    </div>
  )
})
