import { memo } from 'react'
import { fmtEst, cn } from '@/lib/format'
import { prio } from '@/lib/priority'
import { checklistProgress } from '@/lib/stats'
import type { Task } from '@/lib/types'
import { useTaskDrag } from '@/features/dnd/hooks'
import type { TaskMeta } from './meta'
import { ChecklistTag, CoTag, DueTag, ForTag, LinkTag, PrioPill } from './tags'
import { openTask } from './openTask'

/** Card della board: striscia del colore della priorità, azienda · cartella, titolo, stima, avanzamenti. */
export const TaskCard = memo(function TaskCard({
  task,
  today,
  company,
  folder,
  linkDone,
  linkTotal,
  forTitle,
  forMore,
}: TaskMeta & { task: Task; today: string }) {
  const { setNodeRef: dragRef, isDragging, rowProps, handleProps } = useTaskDrag(task.id, 'board')
  const done = task.status === 'done'
  return (
    <div
      ref={dragRef}
      {...rowProps}
      onClick={() => openTask(task.id)}
      className={cn(
        'relative flex cursor-pointer flex-col gap-[7px] rounded-xl border border-line bg-surface-2 px-[11px] pt-2.5 pb-[9px] shadow-[0_1px_1px_rgba(0,0,0,.03)] transition-colors hover:border-accent',
        isDragging && 'opacity-40',
      )}
    >
      <span
        aria-hidden
        className="absolute top-2 bottom-2 -left-px w-[3px] rounded-r-[3px]"
        style={{ background: prio(task.priority).color }}
      />
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
        <CoTag company={company} folder={folder} />
      </div>
      <button
        type="button"
        {...handleProps}
        onClick={(e) => {
          e.stopPropagation()
          openTask(task.id)
        }}
        className={cn('text-left leading-[1.35] font-medium break-words', done && 'text-ink-3 line-through')}
      >
        {task.title}
      </button>
      {forTitle && (
        <div className="flex min-w-0">
          <ForTag title={forTitle} more={forMore} />
        </div>
      )}
      {task.estimate_min > 0 && <span className="num text-xs text-ink-3">{fmtEst(task.estimate_min)}</span>}
      <div className="flex items-center justify-between gap-1.5">
        <PrioPill p={task.priority} />
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          <LinkTag done={linkDone} total={linkTotal} />
          <ChecklistTag progress={checklistProgress(task)} />
          <DueTag task={task} today={today} />
        </span>
      </div>
    </div>
  )
})
