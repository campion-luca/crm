import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { DropTarget } from '@/features/tasks/actions'

/**
 * Rende trascinabile una task. Il puntatore funziona su tutta la riga (`rowProps`);
 * la tastiera solo sul titolo (`handleProps`), così Spazio sulla checkbox non avvia un drag.
 */
export function useTaskDrag(taskId: string, scope: string) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `${scope}:${taskId}`,
    data: { taskId },
  })
  const { onKeyDown, ...pointer } = (listeners ?? {}) as Record<string, (e: unknown) => void>
  return {
    setNodeRef,
    isDragging,
    rowProps: pointer,
    handleProps: {
      onKeyDown,
      'aria-describedby': attributes['aria-describedby'],
      'aria-roledescription': 'task trascinabile',
    },
  }
}

export function useDropTarget(id: string, target: DropTarget) {
  const { setNodeRef, isOver, active } = useDroppable({ id, data: target })
  return { setNodeRef, isOver: isOver && !!active }
}
