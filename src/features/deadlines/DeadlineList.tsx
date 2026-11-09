import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/ui/Module'
import { VirtualList } from '@/components/ui/VirtualList'
import { useData } from '@/data/queries'
import { cn } from '@/lib/format'
import { useToday } from '@/lib/hooks'
import type { Task } from '@/lib/types'
import { useTaskActions } from '@/features/tasks/actions'
import { taskMeta } from '@/features/tasks/meta'
import { DeadlineRow } from '@/features/tasks/TaskRow'
import { flattenGroups, groupDeadlines, type DeadlineRow as Row } from './group'

/**
 * Lista raggruppata per scadenza: In ritardo · Oggi · Domani · Entro 7 giorni · Più avanti
 * (+ Senza scadenza nel pannello azienda). Scorre da sola e si virtualizza oltre ~150 righe.
 */
export function DeadlineList({
  tasks,
  horizon,
  inCompany = false,
  fill = false,
}: {
  tasks: Task[]
  horizon: number | 'all'
  inCompany?: boolean
  /** occupa l'altezza che resta nel modulo (Home a schermo intero) invece di un massimo fisso */
  fill?: boolean
}) {
  const view = useData()
  const today = useToday()
  const { toggleDone } = useTaskActions()
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const rows = useMemo(() => flattenGroups(groupDeadlines(tasks, today, horizon)), [tasks, today, horizon])

  return (
    <div
      ref={setScrollEl}
      className={cn('overflow-auto px-2.5 pt-1.5 pb-3', fill ? 'min-h-0 flex-1' : 'max-h-[640px]')}
    >
      {!rows.length &&
        (horizon === 'all' ? (
          <EmptyState title="Tutto fatto">Non ci sono task da svolgere qui.</EmptyState>
        ) : (
          <EmptyState title="Nessuna scadenza in vista">
            Nei prossimi {horizon} giorni non hai task in scadenza.
          </EmptyState>
        ))}
      <VirtualList<Row>
        items={rows}
        scrollElement={scrollEl}
        getKey={(r) => (r.kind === 'header' ? `h:${r.group.id}` : `t:${r.task.id}`)}
        estimate={(r) => (r.kind === 'header' ? 38 : 58)}
        render={(r) =>
          r.kind === 'header' ? (
            <h4
              className="mx-2 mt-3 mb-1.5 flex items-center gap-[7px] text-[11.5px] font-bold tracking-[0.07em] uppercase"
              style={{ color: r.group.color }}
            >
              <span className="size-2 rounded-full" style={{ background: r.group.color }} aria-hidden />
              {r.group.label}
              <span className="num font-normal text-ink-3">{r.group.items.length}</span>
            </h4>
          ) : (
            <DeadlineRow
              task={r.task}
              today={today}
              inCompany={inCompany}
              onToggle={toggleDone}
              {...taskMeta(r.task, view)}
            />
          )
        }
      />
    </div>
  )
}
