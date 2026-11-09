import { memo } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { cn } from '@/lib/format'
import { checklistProgress } from '@/lib/stats'
import type { Task } from '@/lib/types'
import { openTask } from './openTask'
import { useTaskDrag } from '@/features/dnd/hooks'
import type { TaskMeta } from './meta'
import { ChecklistTag, CoTag, DueTag, FolderTag, ForTag, LinkTag, PrioPill } from './tags'

interface RowProps extends TaskMeta {
  task: Task
  today: string
  /** nel pannello azienda: cartella al posto dell'azienda, più checklist */
  inCompany?: boolean
  onToggle: (id: string) => void
}

/** Riga del modulo In scadenza / Da svolgere. */
export const DeadlineRow = memo(function DeadlineRow({
  task,
  today,
  inCompany,
  onToggle,
  company,
  folder,
  linkDone,
  linkTotal,
  forTitle,
  forMore,
}: RowProps) {
  const { setNodeRef: dragRef, isDragging, rowProps, handleProps } = useTaskDrag(task.id, 'dl')
  return (
    <div
      ref={dragRef}
      {...rowProps}
      onClick={() => openTask(task.id)}
      className={cn(
        'flex cursor-pointer items-center gap-[11px] rounded-xl px-2 py-[9px] transition-colors hover:bg-surface-2 hover:shadow-[inset_2px_0_0_var(--accent)]',
        isDragging && 'opacity-40',
      )}
    >
      <Checkbox
        checked={task.status === 'done'}
        onChange={() => onToggle(task.id)}
        label={`Segna come fatto: ${task.title}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <button
          type="button"
          {...handleProps}
          onClick={(e) => {
            e.stopPropagation()
            openTask(task.id)
          }}
          className="truncate text-left font-semibold"
        >
          {task.title}
        </button>
        <span className="flex min-w-0 items-center gap-2 text-xs text-ink-2">
          {inCompany ? (
            <>
              <FolderTag folder={folder} />
              <LinkTag done={linkDone} total={linkTotal} />
              <ChecklistTag progress={checklistProgress(task)} />
              <ForTag title={forTitle} more={forMore} />
            </>
          ) : (
            <>
              <CoTag company={company} folder={folder} className="[&>span:last-child]:max-w-[150px]" />
              <LinkTag done={linkDone} total={linkTotal} />
              <ForTag title={forTitle} more={forMore} />
            </>
          )}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <PrioPill p={task.priority} />
        <DueTag task={task} today={today} />
      </div>
    </div>
  )
})
