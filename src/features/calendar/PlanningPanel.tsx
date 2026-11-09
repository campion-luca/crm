import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import type { DataView } from '@/data/view'
import { FALLBACK_COLOR } from '@/lib/colors'
import { fmtPanelDate } from '@/lib/dates'
import { sortTasks, sumEstimate } from '@/lib/filters'
import { cn, fmtEst, fmtHours } from '@/lib/format'
import { prio } from '@/lib/priority'
import type { CalendarColorBy, Task } from '@/lib/types'
import { openModal } from '@/stores/modals'
import { MiniTask } from './MiniTask'

function Section({
  title,
  aside,
  children,
  grow,
}: {
  title: string
  aside: ReactNode
  children: ReactNode
  grow?: boolean
}) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col gap-[7px] border-b border-line px-3.5 py-3 last:border-b-0',
        grow && 'flex-1 overflow-auto',
      )}
    >
      <h4 className="m-0 flex items-center justify-between gap-2 text-[13px] font-semibold">
        {title}
        <small className="text-xs font-normal text-ink-3">{aside}</small>
      </h4>
      {children}
    </section>
  )
}

/**
 * Pannello destro del calendario completo: giorno selezionato (con carico rispetto alle ore
 * disponibili) e "Da pianificare" (task senza data, da trascinare sui giorni).
 */
export function PlanningPanel({
  day,
  tasks,
  view,
  colorBy,
  availableHours,
}: {
  day: string
  tasks: Task[]
  view: DataView
  colorBy: CalendarColorBy
  availableHours: number
}) {
  const colorOf = (t: Task) =>
    colorBy === 'priority'
      ? prio(t.priority).color
      : (view.companyById.get(t.company_id)?.color ?? FALLBACK_COLOR)
  const dayItems = sortTasks(tasks.filter((t) => t.due_date === day))
  const est = sumEstimate(dayItems.filter((t) => t.status !== 'done'))
  const unplanned = sortTasks(tasks.filter((t) => !t.due_date && t.status !== 'done'))
  const load = availableHours > 0 ? est / 60 / availableHours : 0

  const mini = (t: Task) => (
    <MiniTask
      key={t.id}
      task={t}
      color={colorOf(t)}
      company={view.companyById.get(t.company_id)}
      folder={t.folder_id ? view.folderById.get(t.folder_id) : undefined}
    />
  )

  return (
    <aside
      aria-label="Giorno selezionato"
      className="flex min-h-0 flex-col overflow-hidden rounded-card border border-line bg-surface"
    >
      <Section title={fmtPanelDate(day)} aside={`${dayItems.length} lavori${est ? ` · ${fmtEst(est)}` : ''}`}>
        {est > 0 && availableHours > 0 && (
          <div
            className="flex items-center gap-2 text-xs text-ink-3"
            title="Tempo stimato rispetto alle ore disponibili"
          >
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span
                className={cn('block h-full rounded-full', load > 1 ? 'bg-danger' : 'bg-accent')}
                style={{ width: `${Math.min(100, Math.round(load * 100))}%` }}
              />
            </div>
            <span className={cn('num', load > 1 && 'text-danger')}>
              {fmtHours(est / 60)} su {fmtHours(availableHours)}
            </span>
          </div>
        )}
        {dayItems.length ? dayItems.map(mini) : <span className="text-xs text-ink-3">Giornata libera.</span>}
        <Button className="self-start" onClick={() => openModal({ kind: 'task', preset: { due_date: day } })}>
          <Plus /> Aggiungi a questo giorno
        </Button>
      </Section>
      <Section title="Da pianificare" aside={unplanned.length} grow>
        <span className="text-xs text-ink-3">
          Lavori senza scadenza. Trascinali su un giorno del calendario.
        </span>
        {unplanned.length ? (
          unplanned.map(mini)
        ) : (
          <span className="text-xs text-ink-3">Tutto ha una data.</span>
        )}
      </Section>
    </aside>
  )
}
