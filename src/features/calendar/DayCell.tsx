import { Plus } from 'lucide-react'
import { memo } from 'react'
import { tint } from '@/lib/colors'
import { fmtDayMonth, fmtTime, isWeekend, parseDate } from '@/lib/dates'
import { cn } from '@/lib/format'
import type { Task } from '@/lib/types'
import { openModal } from '@/stores/modals'
import { useDropTarget, useTaskDrag } from '@/features/dnd/hooks'
import { openTask } from '@/features/tasks/openTask'

interface Props {
  date: string
  tasks: Task[] | undefined
  colorOf: (t: Task) => string
  limit: number
  /** calendario che riempie lo spazio: eventi compatti, "+N" nella testata, niente overflow */
  fill?: boolean
  /** telefono: un pallino colorato per task al posto dei titoli */
  dots?: boolean
  outside: boolean
  isToday: boolean
  picked: boolean
  lastInRow: boolean
  onClick: (date: string) => void
}

/** Cella del giorno: drop target per cambiare scadenza, "+" per creare una task in quella data. */
export const DayCell = memo(function DayCell({
  date,
  tasks = [],
  colorOf,
  limit,
  fill = false,
  dots = false,
  outside,
  isToday,
  picked,
  lastInRow,
  onClick,
}: Props) {
  const { setNodeRef: dropRef, isOver } = useDropTarget(`day:${date}`, { kind: 'day', date })
  const shown = tasks.slice(0, limit)
  const more = tasks.length - shown.length
  const label = fmtDayMonth(date)
  return (
    <div
      ref={dropRef}
      data-date={date}
      onClick={() => onClick(date)}
      className={cn(
        'group relative flex min-w-0 cursor-pointer flex-col border-b border-line px-[5px]',
        fill
          ? 'min-h-0 gap-px overflow-hidden pt-[3px] pb-0'
          : dots
            ? 'items-center gap-1 px-0.5 pt-1.5 pb-1.5'
            : 'gap-[3px] pt-[5px] pb-1.5',
        !lastInRow && 'border-r',
        outside && 'bg-black/35',
        !outside && isWeekend(date) && 'bg-white/[0.025]',
        picked && 'shadow-[inset_0_0_0_2px_var(--accent)]',
        isOver && 'bg-accent-soft outline-2 -outline-offset-2 outline-accent outline-dashed',
      )}
    >
      <div
        className={cn('flex items-center px-0.5 num text-xs', dots ? 'justify-center' : 'justify-between')}
      >
        <button
          type="button"
          aria-label={`${label}: ${tasks.length} task`}
          onClick={(e) => {
            e.stopPropagation()
            onClick(date)
          }}
          className={cn(
            'rounded-[7px] px-1.5',
            fill ? 'py-0 leading-4' : dots ? 'min-w-6 py-0.5 text-[13px]' : 'py-px',
            isToday ? 'bg-accent font-medium text-accent-ink' : outside ? 'text-ink-3' : 'text-ink-2',
          )}
        >
          {parseDate(date).getDate()}
        </button>
        {fill && more > 0 && (
          <span
            className="mr-auto ml-1 text-[10.5px] font-medium text-ink-3"
            title={`${more} altr${more === 1 ? 'a' : 'e'} task: clicca il giorno per vederle`}
          >
            +{more}
          </span>
        )}
        {!dots && (
          <button
            type="button"
            title={`Aggiungi lavoro il ${label}`}
            aria-label={`Aggiungi lavoro il ${label}`}
            onClick={(e) => {
              e.stopPropagation()
              openModal({ kind: 'task', preset: { due_date: date } })
            }}
            className="grid size-[18px] place-items-center rounded text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 [&_svg]:size-3.5"
          >
            <Plus />
          </button>
        )}
      </div>
      {dots
        ? tasks.length > 0 && (
            <div aria-hidden className="flex max-w-full flex-wrap justify-center gap-[3px]">
              {tasks.slice(0, 4).map((t) => (
                <span
                  key={t.id}
                  className={cn('size-1.5 rounded-full', t.status === 'done' && 'opacity-40')}
                  style={{ background: colorOf(t) }}
                />
              ))}
              {tasks.length > 4 && (
                <span className="text-[9.5px] leading-1.5 font-semibold text-ink-3">+{tasks.length - 4}</span>
              )}
            </div>
          )
        : shown.map((t) => <CalEvent key={t.id} task={t} color={colorOf(t)} dense={fill} />)}
      {!fill && !dots && more > 0 && (
        <span className="pl-1 text-[11px] text-ink-3">+{tasks.length - shown.length} altri</span>
      )}
    </div>
  )
})

/** Evento: sfondo al 28% del colore sopra --surface e bordo sinistro pieno di 4px. */
const CalEvent = memo(function CalEvent({
  task,
  color,
  dense,
}: {
  task: Task
  color: string
  dense: boolean
}) {
  const { setNodeRef: dragRef, isDragging, rowProps, handleProps } = useTaskDrag(task.id, 'cal')
  const done = task.status === 'done'
  return (
    <div
      ref={dragRef}
      {...rowProps}
      title={task.title}
      onClick={(e) => {
        e.stopPropagation()
        openTask(task.id)
      }}
      className={cn(
        'flex min-w-0 shrink-0 cursor-pointer items-center gap-1 rounded-md border-l-4 pr-1.5 pl-[5px] font-medium',
        dense ? 'py-px text-[11px] leading-[15px]' : 'py-0.5 text-[11.5px]',
        done ? 'text-ink-2 line-through' : 'text-ink',
        isDragging && 'opacity-40',
      )}
      style={{ borderLeftColor: color, background: tint(color, done ? 14 : 28, 'var(--surface)') }}
    >
      {task.due_time && <span className="shrink-0 num text-[10.5px]">{fmtTime(task.due_time)}</span>}
      <button
        type="button"
        {...handleProps}
        onClick={(e) => {
          e.stopPropagation()
          openTask(task.id)
        }}
        className="min-w-0 truncate text-left"
      >
        {task.title}
      </button>
    </div>
  )
})
