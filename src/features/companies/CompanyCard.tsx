import { Folder as FolderIcon, MoreHorizontal, Plus } from 'lucide-react'
import { memo, type CSSProperties } from 'react'
import { chipClass } from '@/components/ui/chipClass'
import { useData } from '@/data/queries'
import { cn, fmtEst } from '@/lib/format'
import { useGoCompany, useToday } from '@/lib/hooks'
import { initials } from '@/lib/profile'
import { companyStats } from '@/lib/stats'
import type { Company } from '@/lib/types'
import { openModal } from '@/stores/modals'
import { useDropTarget } from '@/features/dnd/hooks'
import { DueTag } from '@/features/tasks/tags'

const AVATAR_SIZES = {
  sm: 'size-[30px] rounded-[9px] text-[11.5px]',
  md: 'size-10 rounded-xl text-sm',
  xl: 'size-[58px] rounded-2xl text-xl',
}

/** Avatar dell'azienda: la miniatura del logo (Setup aziendale) oppure le iniziali. */
export function Avatar({
  name,
  logo,
  size = 'md',
}: {
  name: string
  /** data URL della miniatura del logo */
  logo?: string | undefined
  size?: 'sm' | 'md' | 'xl'
}) {
  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        aria-hidden
        className={cn('shrink-0 border border-line object-cover', AVATAR_SIZES[size])}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center bg-[color-mix(in_srgb,var(--c)_26%,var(--surface))] font-extrabold tracking-[0.02em] text-[color-mix(in_srgb,var(--c)_55%,#fff)]',
        AVATAR_SIZES[size],
      )}
    >
      {initials(name) || '?'}
    </span>
  )
}

/**
 * Card azienda: barra superiore nel colore dell'azienda, numeri, avanzamento e prossima scadenza.
 * È anche un drop target: trascinandoci una task la sposti in quell'azienda.
 */
export const CompanyCard = memo(function CompanyCard({
  company,
  big = false,
  dense = false,
}: {
  company: Company
  /** pagina Aziende: con le chip delle cartelle */
  big?: boolean
  /** griglia da 3 della Home */
  dense?: boolean
}) {
  const view = useData()
  const today = useToday()
  const goCompany = useGoCompany()
  const { setNodeRef: dropRef, isOver } = useDropTarget(`card-co:${company.id}`, {
    kind: 'company',
    companyId: company.id,
  })
  const st = companyStats(view.tasksOf(company.id), view.foldersOf(company.id), today)
  const open = () => goCompany(company.id)

  return (
    <article
      ref={dropRef}
      onClick={open}
      style={{ '--c': company.color } as CSSProperties}
      className={cn(
        'squircle relative flex cursor-pointer flex-col overflow-hidden rounded-[18px] border border-line bg-surface text-left shadow-[0_1px_2px_rgba(0,0,0,.2),0_8px_22px_rgba(0,0,0,.2)] transition-[translate,box-shadow,border-color] duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[5px] before:bg-(--c) hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_2px_4px_rgba(0,0,0,.25),0_14px_30px_rgba(0,0,0,.3)]',
        dense ? 'gap-2.5 p-3.5' : 'gap-3 p-4',
        isOver && 'outline-2 -outline-offset-2 outline-accent outline-dashed',
      )}
    >
      <div className="flex items-center gap-[11px]">
        <Avatar name={company.name} logo={company.brand.avatar} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="m-0 truncate text-[15px] font-bold">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                open()
              }}
              className="max-w-full truncate text-left"
            >
              {company.name}
            </button>
          </h3>
          <span className="truncate text-xs text-ink-3">
            {st.folders.length} cartell{st.folders.length === 1 ? 'a' : 'e'}
            {st.estMin ? ` · ${fmtEst(st.estMin)} stimati` : ''}
          </span>
        </div>
        <button
          type="button"
          title="Modifica azienda"
          aria-label={`Modifica ${company.name}`}
          onClick={(e) => {
            e.stopPropagation()
            openModal({ kind: 'company', companyId: company.id })
          }}
          className="hit-slop grid h-7 w-6 shrink-0 place-items-center rounded-[5px] text-ink-3 hover:bg-surface-2 hover:text-ink [&_svg]:size-[15px]"
        >
          <MoreHorizontal />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Num n={st.open.length} label="aperti" dense={dense} />
        <Num n={st.over} label="ritardo" hot={st.over > 0} dense={dense} />
        <Num n={st.week} label="7 giorni" dense={dense} />
      </div>

      <div
        className="h-[7px] overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label={`Avanzamento ${company.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={st.pct}
      >
        <span className="block h-full rounded-full bg-(--c)" style={{ width: `${st.pct}%` }} />
      </div>
      <div className="-mt-1.5 flex justify-between text-xs text-ink-3">
        <span>
          {st.done} fatti su {st.total}
        </span>
        <span className="num">{st.pct}%</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-[rgba(255,110,180,.35)] pt-2.5 text-[13px]">
        {st.next ? (
          <>
            <span className="text-xs text-ink-3">Prossima</span>
            <b className="max-w-[60%] truncate font-semibold">{st.next.title}</b>
            <DueTag task={st.next} today={today} />
          </>
        ) : (
          <span className="text-xs text-ink-3">Nessuna scadenza in programma</span>
        )}
      </div>

      {big && (
        <div className="flex flex-wrap gap-1.5">
          {st.folders.map((f) => (
            <button
              key={f.id}
              type="button"
              className={chipClass(false)}
              onClick={(e) => {
                e.stopPropagation()
                goCompany(company.id, f.id)
              }}
            >
              <FolderIcon aria-hidden />
              {f.name}
            </button>
          ))}
          <button
            type="button"
            className={chipClass(false)}
            onClick={(e) => {
              e.stopPropagation()
              openModal({ kind: 'folder', companyId: company.id })
            }}
          >
            <Plus aria-hidden /> Cartella
          </button>
        </div>
      )}
    </article>
  )
})

function Num({ n, label, hot, dense }: { n: number; label: string; hot?: boolean; dense?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-[10px]',
        dense ? 'px-2 py-[7px]' : 'px-2.5 py-2',
        hot ? 'bg-[rgba(255,93,115,.16)] text-danger-ink' : 'bg-surface-2',
      )}
    >
      <b className={cn('num leading-[1.1] font-medium', dense ? 'text-lg' : 'text-xl')}>{n}</b>
      <span className={cn('text-[11.5px] whitespace-nowrap', hot ? 'text-danger-ink' : 'text-ink-2')}>
        {label}
      </span>
    </div>
  )
}

export function NewCompanyCard() {
  return (
    <button
      type="button"
      onClick={() => openModal({ kind: 'company' })}
      className="flex min-h-[200px] flex-col items-center justify-center gap-1.5 rounded-[18px] border-2 border-dashed border-line text-ink-2 transition-colors hover:border-accent"
    >
      <Plus className="size-[26px] text-accent" aria-hidden />
      <b className="text-[15px] text-ink">Nuova azienda</b>
      <span className="text-xs text-ink-3">Cliente, brand o progetto</span>
    </button>
  )
}
