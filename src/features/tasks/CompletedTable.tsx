import { Check } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState, Module, ModuleFooter } from '@/components/ui/Module'
import { VirtualList } from '@/components/ui/VirtualList'
import { useData } from '@/data/queries'
import { fmtDone, fmtShortDate, lateDays } from '@/lib/dates'
import { cn } from '@/lib/format'
import { useNow, useScrollParent } from '@/lib/hooks'
import type { Company, Folder, Task } from '@/lib/types'
import { useUi } from '@/stores/ui'
import { useTaskActions } from './actions'
import { CoTag, PrioPill } from './tags'
import { openTask } from './openTask'

const COLS =
  'grid grid-cols-[40px_minmax(180px,2.2fr)_minmax(140px,1.4fr)_64px_72px_120px_130px] items-center'

/**
 * Tabella Completi: ordinata per completed_at decrescente, ultime 10 e poi "Mostra tutte".
 * Togliere la spunta riapre la task. `compact` (Home): righe su due livelli che stanno in una
 * colonna stretta, con scroll interno.
 */
export function CompletedTable({
  tasks,
  inCompany = false,
  compact = false,
  fill = false,
  className,
}: {
  tasks: Task[]
  inCompany?: boolean
  compact?: boolean
  /** occupa l'altezza che resta nel modulo (Home a schermo intero) */
  fill?: boolean
  className?: string
}) {
  const view = useData()
  const now = useNow()
  const pageScroll = useScrollParent()
  const [ownScroll, setOwnScroll] = useState<HTMLDivElement | null>(null)
  const { toggleDone } = useTaskActions()
  const showAll = useUi((s) => s.showAllDone)
  const toggleAll = useUi((s) => s.toggleShowAllDone)

  const done = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'done')
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [tasks],
  )
  const rows = showAll ? done : done.slice(0, 10)

  return (
    <Module
      title="Completi"
      icon={<Check strokeWidth={3} />}
      iconTone="ok"
      count={done.length}
      className={className}
    >
      {!done.length ? (
        <EmptyState title="Ancora niente qui">
          Quando spunti una task la trovi in questa tabella, con data e ora.
        </EmptyState>
      ) : compact ? (
        <div
          ref={setOwnScroll}
          role="list"
          aria-label="Task completate"
          className={cn('overflow-auto px-2.5 py-1.5', fill ? 'min-h-0 flex-1' : 'max-h-[420px]')}
        >
          <VirtualList
            items={rows}
            scrollElement={ownScroll}
            getKey={(t) => t.id}
            estimate={() => 58}
            render={(t) => (
              <DoneItem
                task={t}
                company={view.companyById.get(t.company_id)}
                folder={t.folder_id ? view.folderById.get(t.folder_id) : undefined}
                now={now.getTime()}
                onToggle={toggleDone}
              />
            )}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div role="table" aria-label="Task completate" className="min-w-[780px]">
            <div role="rowgroup">
              <div role="row" className={`${COLS} border-b border-line`}>
                <span role="columnheader" className="px-3 py-2 th-accent">
                  <span className="sr-only">Fatto</span>
                </span>
                {[
                  'Task',
                  inCompany ? 'Cartella' : 'Azienda / cartella',
                  'Priorità',
                  'Scadenza',
                  'Completata il',
                  'Esito',
                ].map((h) => (
                  <span key={h} role="columnheader" className="px-3 py-2 th-accent">
                    {h}
                  </span>
                ))}
              </div>
            </div>
            <div role="rowgroup">
              <VirtualList
                items={rows}
                scrollElement={pageScroll}
                getKey={(t) => t.id}
                estimate={() => 43}
                render={(t) => (
                  <DoneRow
                    task={t}
                    company={view.companyById.get(t.company_id)}
                    folder={t.folder_id ? view.folderById.get(t.folder_id) : undefined}
                    inCompany={inCompany}
                    now={now.getTime()}
                    onToggle={toggleDone}
                  />
                )}
              />
            </div>
          </div>
        </div>
      )}
      {done.length > 10 && (
        <ModuleFooter>
          <span>{showAll ? `Tutte le ${done.length} completate` : `Ultime 10 di ${done.length}`}</span>
          <LinkButton onClick={toggleAll}>{showAll ? 'Mostra meno' : 'Mostra tutte'}</LinkButton>
        </ModuleFooter>
      )}
    </Module>
  )
}

/** Esito: "In tempo" verde oppure "N gg di ritardo" rosso (completamento vs scadenza). */
function Outcome({ task }: { task: Task }) {
  const late = lateDays(task)
  if (late == null) return <span className="text-xs text-ink-3">—</span>
  return late > 0 ? (
    <span className="rounded-full bg-[rgba(255,93,115,.14)] px-2 py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-danger-ink">
      {late} gg di ritardo
    </span>
  ) : (
    <span className="rounded-full bg-[rgba(61,220,151,.14)] px-2 py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-ok">
      In tempo
    </span>
  )
}

/** Riga compatta (Home): titolo barrato e azienda a sinistra, data, priorità ed esito a destra. */
const DoneItem = memo(function DoneItem({
  task,
  company,
  folder,
  now,
  onToggle,
}: {
  task: Task
  company: Company | undefined
  folder: Folder | undefined
  now: number
  onToggle: (id: string) => void
}) {
  return (
    <div
      role="listitem"
      onClick={() => openTask(task.id)}
      className="flex cursor-pointer items-center gap-[11px] rounded-xl px-2 py-2 transition-colors hover:bg-surface-2"
    >
      <Checkbox checked onChange={() => onToggle(task.id)} label={`Riapri: ${task.title}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openTask(task.id)
          }}
          className="truncate text-left font-medium text-ink-2 line-through decoration-[rgba(61,220,151,.6)]"
        >
          {task.title}
        </button>
        <span className="flex min-w-0 items-center text-xs text-ink-2">
          <CoTag company={company} folder={folder} />
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="num text-[11.5px] whitespace-nowrap text-ok">
          {fmtDone(task.completed_at, new Date(now))}
        </span>
        <span className="flex items-center gap-1.5">
          <PrioPill p={task.priority} />
          <Outcome task={task} />
        </span>
      </div>
    </div>
  )
})

const DoneRow = memo(function DoneRow({
  task,
  company,
  folder,
  inCompany,
  now,
  onToggle,
}: {
  task: Task
  company: Company | undefined
  folder: Folder | undefined
  inCompany: boolean
  now: number
  onToggle: (id: string) => void
}) {
  return (
    <div
      role="row"
      onClick={() => openTask(task.id)}
      className={`${COLS} cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-surface-2`}
    >
      <span role="cell" className="px-3 py-[9px]">
        <Checkbox checked onChange={() => onToggle(task.id)} label={`Riapri: ${task.title}`} />
      </span>
      <span role="cell" className="min-w-0 px-3 py-[9px]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openTask(task.id)
          }}
          className="max-w-full truncate text-left font-medium text-ink-2 line-through decoration-[rgba(61,220,151,.6)]"
        >
          {task.title}
        </button>
      </span>
      <span role="cell" className="min-w-0 px-3 py-[9px] text-xs text-ink-2">
        {inCompany ? (
          folder ? (
            folder.name
          ) : (
            <span className="text-ink-3">—</span>
          )
        ) : (
          <CoTag company={company} folder={folder} />
        )}
      </span>
      <span role="cell" className="px-3 py-[9px]">
        <PrioPill p={task.priority} />
      </span>
      <span role="cell" className="px-3 py-[9px] num text-xs text-ink-3">
        {task.due_date ? fmtShortDate(task.due_date) : '—'}
      </span>
      <span role="cell" className="px-3 py-[9px] num text-xs whitespace-nowrap text-ok">
        {fmtDone(task.completed_at, new Date(now))}
      </span>
      <span role="cell" className="px-3 py-[9px]">
        <Outcome task={task} />
      </span>
    </div>
  )
})
