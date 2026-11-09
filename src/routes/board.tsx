import type { CSSProperties } from 'react'
import { Plus } from 'lucide-react'
import { DashedEmpty } from '@/components/ui/Module'
import { useData, useSettings } from '@/data/queries'
import type { DataView } from '@/data/view'
import { sortTasks, sumEstimate } from '@/lib/filters'
import { cn, fmtEst } from '@/lib/format'
import { useToday } from '@/lib/hooks'
import { STATI, type StatusDef } from '@/lib/priority'
import type { Task } from '@/lib/types'
import { openModal } from '@/stores/modals'
import { useFilteredTasks } from '@/app/useTaskFilters'
import { useDropTarget } from '@/features/dnd/hooks'
import { taskMeta } from '@/features/tasks/meta'
import { TaskCard } from '@/features/tasks/TaskCard'

/** Board: Da fare / In corso / In revisione / Fatto. Si trascina tra le colonne. */
export function BoardPage() {
  const view = useData()
  const { show_done } = useSettings()
  const tasks = useFilteredTasks()
  const today = useToday()
  const columns = STATI.filter((s) => s.id !== 'done' || show_done)

  return (
    // telefono: una colonna quasi a tutta larghezza alla volta, con lo scorrimento che si aggancia
    <div className="overflow-x-auto mobile:-mx-4 mobile:snap-x mobile:snap-mandatory mobile:scroll-px-4 mobile:px-4">
      <div
        className="grid min-h-full grid-cols-[repeat(var(--cols),minmax(240px,1fr))] items-start gap-3.5 mobile:grid-cols-[repeat(var(--cols),84vw)] mobile:gap-3"
        style={{ '--cols': columns.length } as CSSProperties}
      >
        {columns.map((s) => (
          <Column
            key={s.id}
            status={s}
            items={sortTasks(tasks.filter((t) => t.status === s.id))}
            view={view}
            today={today}
          />
        ))}
      </div>
    </div>
  )
}

function Column({
  status,
  items,
  view,
  today,
}: {
  status: StatusDef
  items: Task[]
  view: DataView
  today: string
}) {
  const { setNodeRef: dropRef, isOver } = useDropTarget(`col:${status.id}`, {
    kind: 'status',
    status: status.id,
  })
  const est = sumEstimate(items)
  return (
    <section
      ref={dropRef}
      aria-label={status.label}
      className={cn(
        'flex min-h-[200px] flex-col gap-2 rounded-card bg-surface p-2 mobile:snap-start',
        isOver && 'outline-2 -outline-offset-2 outline-accent outline-dashed',
      )}
    >
      <div className="flex items-center gap-2 px-1.5 pt-1 pb-0.5 text-[13px] font-semibold">
        <span className="size-2 rounded-full" style={{ background: status.color }} aria-hidden />
        <h3 className="m-0 text-[13px] font-semibold">{status.label}</h3>
        <span className="num text-[11.5px] font-normal text-ink-3">
          {items.length}
          {est > 0 && status.id !== 'done' ? ` · ${fmtEst(est)}` : ''}
        </span>
        <button
          type="button"
          title={`Aggiungi in ${status.label}`}
          aria-label={`Aggiungi in ${status.label}`}
          onClick={() => openModal({ kind: 'task', preset: { status: status.id } })}
          className="hit-slop ml-auto grid size-6 place-items-center rounded-[5px] text-ink-3 hover:bg-surface-2 hover:text-ink [&_svg]:size-[15px]"
        >
          <Plus />
        </button>
      </div>
      {items.length ? (
        items.map((t) => <TaskCard key={t.id} task={t} today={today} {...taskMeta(t, view)} />)
      ) : (
        <DashedEmpty>Niente qui. Trascina un lavoro o premi +</DashedEmpty>
      )}
    </section>
  )
}
