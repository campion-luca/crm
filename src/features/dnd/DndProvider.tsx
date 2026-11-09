import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useState, type ReactNode } from 'react'
import { useData } from '@/data/queries'
import { prio } from '@/lib/priority'
import { useTaskActions, type DropTarget } from '@/features/tasks/actions'

/** Il puntatore decide il target; con la tastiera (nessun puntatore) si usa l'intersezione. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length ? hits : rectIntersection(args)
}

const targetLabel = (t: DropTarget | undefined) => {
  if (!t) return 'nessun target'
  switch (t.kind) {
    case 'status':
      return `colonna ${t.status}`
    case 'day':
      return `giorno ${t.date}`
    case 'company':
      return 'azienda'
    case 'folder':
      return 'cartella'
  }
}

const announcements: Announcements = {
  onDragStart: () => 'Task presa. Usa le frecce per spostarla, spazio per rilasciarla, Esc per annullare.',
  onDragOver: ({ over }) =>
    over ? `Sopra ${targetLabel(over.data.current as DropTarget)}` : 'Fuori dai target',
  onDragEnd: ({ over }) =>
    over ? `Rilasciata su ${targetLabel(over.data.current as DropTarget)}` : 'Rilasciata',
  onDragCancel: () => 'Spostamento annullato',
}

/**
 * Un solo DndContext per tutta l'app: si può trascinare una task da board, liste e calendario
 * fino a colonne, giorni, aziende e cartelle (anche nella sidebar).
 */
export function DndProvider({ children }: { children: ReactNode }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const { moveTask } = useTaskActions()

  const onDragStart = (e: DragStartEvent) => setActiveId((e.active.data.current as { taskId: string }).taskId)
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const taskId = (e.active.data.current as { taskId: string } | undefined)?.taskId
    const target = e.over?.data.current as DropTarget | undefined
    if (taskId && target) moveTask(taskId, target)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: 'Premi spazio per prendere la task.' },
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>{activeId ? <DragPreview taskId={activeId} /> : null}</DragOverlay>
    </DndContext>
  )
}

function DragPreview({ taskId }: { taskId: string }) {
  const { taskById, companyById } = useData()
  const t = taskById.get(taskId)
  if (!t) return null
  const c = companyById.get(t.company_id)
  return (
    <div className="pointer-events-none relative flex w-[240px] cursor-grabbing flex-col gap-1 rounded-xl border border-accent bg-surface-2 px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,.45)]">
      <span
        className="absolute top-2 bottom-2 -left-px w-[3px] rounded-r"
        style={{ background: prio(t.priority).color }}
      />
      {c && (
        <span className="flex items-center gap-1.5 text-xs text-ink-2">
          <span className="size-2 rounded-[2px]" style={{ background: c.color }} />
          {c.name}
        </span>
      )}
      <span className="truncate font-medium">{t.title}</span>
    </div>
  )
}
