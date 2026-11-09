import { Plus } from 'lucide-react'
import { memo, type CSSProperties } from 'react'
import { useData } from '@/data/queries'
import { cn } from '@/lib/format'
import { useGoCompany, useToday } from '@/lib/hooks'
import { companyStats } from '@/lib/stats'
import type { Company } from '@/lib/types'
import { openModal } from '@/stores/modals'
import { useDropTarget } from '@/features/dnd/hooks'
import { Avatar } from './CompanyCard'

/**
 * Aziende in versione compatta per la Home a schermo intero: stessa barra colore, avatar, numeri e
 * avanzamento delle card, in una riga sola (scorre in orizzontale se le aziende sono tante).
 * Le card complete restano nella pagina Aziende.
 */
export function CompanyStrip() {
  const { companies } = useData()
  if (!companies.length) {
    return (
      <button
        type="button"
        onClick={() => openModal({ kind: 'company' })}
        className="flex h-16 items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-line text-ink-2 transition-colors hover:border-accent"
      >
        <Plus className="size-5 text-accent" aria-hidden />
        <b className="text-ink">Nuova azienda</b>
        <span className="text-xs text-ink-3">Cliente, brand o progetto</span>
      </button>
    )
  }
  return (
    <div className="flex gap-3 overflow-x-auto pt-0.5 pb-1">
      {companies.map((c) => (
        <CompanyMini key={c.id} company={c} />
      ))}
    </div>
  )
}

const CompanyMini = memo(function CompanyMini({ company }: { company: Company }) {
  const view = useData()
  const today = useToday()
  const goCompany = useGoCompany()
  const { setNodeRef, isOver } = useDropTarget(`strip-co:${company.id}`, {
    kind: 'company',
    companyId: company.id,
  })
  const st = companyStats(view.tasksOf(company.id), view.foldersOf(company.id), today)
  const open = () => goCompany(company.id)

  return (
    <article
      ref={setNodeRef}
      onClick={open}
      style={{ '--c': company.color } as CSSProperties}
      className={cn(
        'squircle relative flex min-w-[190px] flex-1 cursor-pointer flex-col gap-1.5 overflow-hidden rounded-[14px] border border-line bg-surface px-3 pt-3 pb-2.5 shadow-[0_1px_2px_rgba(0,0,0,.2),0_6px_16px_rgba(0,0,0,.18)] transition-[translate,border-color] duration-150 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-(--c) hover:-translate-y-0.5 hover:border-accent',
        isOver && 'outline-2 -outline-offset-2 outline-accent outline-dashed',
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={company.name} logo={company.brand.avatar} size="sm" />
        <h4 className="m-0 min-w-0 flex-1 truncate text-sm font-bold">
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
        </h4>
        <span className="shrink-0 num text-xs text-ink-3">{st.pct}%</span>
      </div>
      <span className="truncate text-[11.5px] text-ink-2">
        <b className="num font-medium text-ink">{st.open.length}</b> aperti ·{' '}
        <b className={cn('num font-medium', st.over ? 'text-danger-ink' : 'text-ink')}>{st.over}</b> ritardo ·{' '}
        <b className="num font-medium text-ink">{st.week}</b> entro 7 gg
      </span>
      <div
        className="h-1 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label={`Avanzamento ${company.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={st.pct}
      >
        <span className="block h-full rounded-full bg-(--c)" style={{ width: `${st.pct}%` }} />
      </div>
    </article>
  )
})
