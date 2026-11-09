import { Plus } from 'lucide-react'
import { memo, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { DashedEmpty } from '@/components/ui/Module'
import { VirtualList } from '@/components/ui/VirtualList'
import { useData } from '@/data/queries'
import { sortTasks, sumEstimate } from '@/lib/filters'
import { cn, fmtEst } from '@/lib/format'
import { useScrollParent, useToday } from '@/lib/hooks'
import { PRIOS, STATI } from '@/lib/priority'
import { checklistProgress } from '@/lib/stats'
import type { Task } from '@/lib/types'
import { openModal } from '@/stores/modals'
import { useUi } from '@/stores/ui'
import { useFilteredTasks } from '@/app/useTaskFilters'
import { useTaskDrag } from '@/features/dnd/hooks'
import { useTaskActions } from '@/features/tasks/actions'
import { taskMeta, type TaskMeta } from '@/features/tasks/meta'
import { ChecklistTag, CoTag, DueTag, ForTag, LinkTag, PrioPill, StatusPill } from '@/features/tasks/tags'
import { openTask } from '@/features/tasks/openTask'

const COLS = 'grid grid-cols-[36px_minmax(220px,2.4fr)_minmax(150px,1.3fr)_64px_110px_96px_70px] items-center'
// telefono: niente tabella da scorrere di lato, ogni task su due righe (titolo e priorità, azienda e scadenza)
const MOBILE_ROW = 'mobile:grid-cols-[44px_minmax(0,1fr)_auto] mobile:grid-rows-[auto_auto]'

interface Group {
  key: string
  label: string
  color: string
  items: Task[]
}

type Row =
  | { kind: 'group'; group: Group; first: boolean }
  | { kind: 'head'; group: Group }
  | { kind: 'task'; task: Task; first: boolean; last: boolean }

/** Lista task raggruppabile per priorità / azienda / stato, con ore stimate per gruppo. */
export function ListPage() {
  const view = useData()
  const today = useToday()
  const scrollEl = useScrollParent()
  const listGroup = useUi((s) => s.listGroup)
  const filtered = useFilteredTasks()
  const { toggleDone } = useTaskActions()

  const rows = useMemo(() => {
    const tasks = sortTasks(filtered)
    let groups: Group[]
    if (listGroup === 'company') {
      groups = view.companies.map((c) => ({
        key: c.id,
        label: c.name,
        color: c.color,
        items: tasks.filter((t) => t.company_id === c.id),
      }))
    } else if (listGroup === 'status') {
      groups = STATI.map((s) => ({
        key: s.id,
        label: s.label,
        color: s.color,
        items: tasks.filter((t) => t.status === s.id),
      }))
    } else {
      groups = PRIOS.map((p) => ({
        key: String(p.id),
        label: `Priorità ${p.id} · ${p.name}`,
        color: p.color,
        items: tasks.filter((t) => t.priority === p.id),
      }))
    }
    return groups
      .filter((g) => g.items.length)
      .flatMap((g, gi): Row[] => [
        { kind: 'group', group: g, first: gi === 0 },
        { kind: 'head', group: g },
        ...g.items.map((task, i) => ({
          kind: 'task' as const,
          task,
          first: i === 0,
          last: i === g.items.length - 1,
        })),
      ])
  }, [filtered, listGroup, view.companies])

  if (!rows.length) {
    return view.companies.length ? (
      <DashedEmpty className="mx-auto mt-10 max-w-[420px] p-7">
        Nessun lavoro corrisponde ai filtri attivi.
      </DashedEmpty>
    ) : (
      <DashedEmpty className="mx-auto mt-10 max-w-[420px] p-7">
        Inizia creando la prima azienda, poi aggiungi cartelle e lavori.
        <div className="mt-5">
          <Button variant="primary" onClick={() => openModal({ kind: 'company' })}>
            <Plus /> Nuova azienda
          </Button>
        </div>
      </DashedEmpty>
    )
  }

  return (
    <div className="overflow-x-auto mobile:overflow-visible">
      <div role="table" aria-label="Lista task" className="min-w-[820px] mobile:min-w-0">
        <VirtualList<Row>
          items={rows}
          scrollElement={scrollEl}
          getKey={(r) => (r.kind === 'task' ? r.task.id : `${r.kind}:${r.group.key}`)}
          estimate={(r) => (r.kind === 'group' ? (r.first ? 30 : 50) : r.kind === 'head' ? 34 : 44)}
          render={(r) => {
            if (r.kind === 'group') {
              const est = sumEstimate(r.group.items.filter((t) => t.status !== 'done'))
              return (
                <div
                  role="row"
                  className={cn(
                    'flex items-center gap-2 px-0.5 pb-2 text-[13px] font-semibold',
                    r.first ? 'pt-1' : 'pt-6',
                  )}
                >
                  <span role="rowheader" className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-[3px]"
                      style={{ background: r.group.color }}
                      aria-hidden
                    />
                    {r.group.label}
                    <span className="num text-[11.5px] font-normal text-ink-3">
                      {r.group.items.length}
                      {est ? ` · ${fmtEst(est)} stimati` : ''}
                    </span>
                  </span>
                </div>
              )
            }
            if (r.kind === 'head') {
              return (
                <div
                  role="row"
                  className={`${COLS} rounded-t-[10px] border border-line bg-surface mobile:hidden`}
                >
                  <span role="columnheader" className="px-3 py-2 th-accent">
                    <span className="sr-only">Fatto</span>
                  </span>
                  {['Task', 'Azienda / cartella', 'Priorità', 'Stato', 'Scadenza'].map((h) => (
                    <span key={h} role="columnheader" className="px-3 py-2 th-accent">
                      {h}
                    </span>
                  ))}
                  <span role="columnheader" className="px-3 py-2 th-accent text-right">
                    Stima
                  </span>
                </div>
              )
            }
            return (
              <ListRow
                task={r.task}
                first={r.first}
                last={r.last}
                today={today}
                onToggle={toggleDone}
                {...taskMeta(r.task, view)}
              />
            )
          }}
        />
      </div>
    </div>
  )
}

const ListRow = memo(function ListRow({
  task,
  first,
  last,
  today,
  onToggle,
  company,
  folder,
  linkDone,
  linkTotal,
  forTitle,
  forMore,
}: TaskMeta & {
  task: Task
  first: boolean
  last: boolean
  today: string
  onToggle: (id: string) => void
}) {
  const { setNodeRef: dragRef, isDragging, rowProps, handleProps } = useTaskDrag(task.id, 'list')
  const done = task.status === 'done'
  return (
    <div
      role="row"
      ref={dragRef}
      {...rowProps}
      onClick={() => openTask(task.id)}
      className={cn(
        COLS,
        MOBILE_ROW,
        'cursor-pointer border-x border-t border-line bg-surface transition-colors hover:bg-surface-2',
        last && 'rounded-b-[10px] border-b',
        first && 'mobile:rounded-t-[10px]',
        isDragging && 'opacity-40',
      )}
    >
      <span role="cell" className="px-3 py-[9px] mobile:row-span-2 mobile:px-1.5">
        <Checkbox
          checked={done}
          onChange={() => onToggle(task.id)}
          label={done ? `Riapri: ${task.title}` : `Segna come fatto: ${task.title}`}
        />
      </span>
      <span
        role="cell"
        className="flex min-w-0 flex-wrap items-center gap-1.5 px-3 py-[9px] mobile:col-start-2 mobile:row-start-1 mobile:px-1 mobile:pt-2.5 mobile:pb-0.5"
      >
        <button
          type="button"
          {...handleProps}
          onClick={(e) => {
            e.stopPropagation()
            openTask(task.id)
          }}
          className={cn('min-w-0 truncate text-left font-medium', done && 'text-ink-3 line-through')}
        >
          {task.title}
        </button>
        <LinkTag done={linkDone} total={linkTotal} />
        <ChecklistTag progress={checklistProgress(task)} />
        <ForTag title={forTitle} more={forMore} />
      </span>
      <span
        role="cell"
        className="min-w-0 px-3 py-[9px] text-xs text-ink-2 mobile:col-start-2 mobile:row-start-2 mobile:px-1 mobile:pt-0 mobile:pb-2.5"
      >
        <CoTag company={company} folder={folder} />
      </span>
      <span
        role="cell"
        className="px-3 py-[9px] mobile:col-start-3 mobile:row-start-1 mobile:justify-self-end mobile:pt-2.5 mobile:pb-0.5"
      >
        <PrioPill p={task.priority} />
      </span>
      <span role="cell" className="px-3 py-[9px] mobile:hidden">
        <StatusPill s={task.status} />
      </span>
      <span
        role="cell"
        className="px-3 py-[9px] mobile:col-start-3 mobile:row-start-2 mobile:justify-self-end mobile:pt-0 mobile:pb-2.5"
      >
        <DueTag task={task} today={today} />
      </span>
      <span role="cell" className="px-3 py-[9px] text-right num text-xs text-ink-3 mobile:hidden">
        {fmtEst(task.estimate_min) || '—'}
      </span>
    </div>
  )
})
