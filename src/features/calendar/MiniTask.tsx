import { Clock } from 'lucide-react'
import { memo } from 'react'
import { fmtTime } from '@/lib/dates'
import { cn } from '@/lib/format'
import type { Company, Folder, Task } from '@/lib/types'
import { useTaskDrag } from '@/features/dnd/hooks'
import { CoTag, PrioPill } from '@/features/tasks/tags'
import { openTask } from '@/features/tasks/openTask'

/** Card piccola del pannello del giorno, di "Da pianificare" e della modale del giorno. */
export const MiniTask = memo(function MiniTask({
  task,
  color,
  company,
  folder,
  timeFirst = false,
  draggable = true,
  onOpen = openTask,
}: {
  task: Task
  color: string
  company: Company | undefined
  folder: Folder | undefined
  /** modale del giorno: l'ora davanti al titolo */
  timeFirst?: boolean
  draggable?: boolean
  onOpen?: (id: string) => void
}) {
  const {
    setNodeRef: dragRef,
    isDragging,
    rowProps,
    handleProps,
  } = useTaskDrag(task.id, timeFirst ? 'day' : 'mini')
  const done = task.status === 'done'
  const dragProps = draggable ? rowProps : {}
  return (
    <div
      ref={draggable ? dragRef : undefined}
      {...dragProps}
      onClick={() => onOpen(task.id)}
      className={cn(
        'flex cursor-pointer flex-col gap-1 rounded-md border border-l-[3px] border-line bg-surface px-[9px] py-[7px] transition-colors hover:border-accent',
        isDragging && 'opacity-40',
      )}
      style={{ borderLeftColor: color }}
    >
      <button
        type="button"
        {...(draggable ? handleProps : {})}
        onClick={(e) => {
          e.stopPropagation()
          onOpen(task.id)
        }}
        className={cn('text-left text-[13px] font-medium', done && 'text-ink-3 line-through')}
      >
        {timeFirst && task.due_time && (
          <span className="mr-1 num text-xs text-ink-3">{fmtTime(task.due_time)}</span>
        )}
        {task.title}
      </button>
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
        <CoTag company={company} folder={folder} />
        {timeFirst && <PrioPill p={task.priority} />}
      </span>
      {!timeFirst && (
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
          <PrioPill p={task.priority} />
          {task.due_time && (
            <span className="inline-flex items-center gap-1 num text-[11.5px]">
              <Clock className="size-3" aria-hidden />
              {fmtTime(task.due_time)}
            </span>
          )}
        </span>
      )}
    </div>
  )
})
