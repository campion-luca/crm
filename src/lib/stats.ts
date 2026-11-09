import type { LinkIndex } from './cycles'
import { addDaysISO } from './dates'
import { isOver, sumEstimate } from './filters'
import type { Folder, Task } from './types'

export interface CompanyStats {
  total: number
  open: Task[]
  done: number
  over: number
  today: number
  week: number
  estMin: number
  pct: number
  next: Task | undefined
  folders: Folder[]
}

/** Numeri della card azienda e dei KPI del pannello. */
export function companyStats(tasks: Task[], folders: Folder[], today: string): CompanyStats {
  const open = tasks.filter((t) => t.status !== 'done')
  const done = tasks.length - open.length
  const in7 = addDaysISO(today, 7)
  const next = open
    .filter((t) => t.due_date >= today)
    .sort((a, b) =>
      `${a.due_date}${a.due_time ?? '99'}`.localeCompare(`${b.due_date}${b.due_time ?? '99'}`),
    )[0]
  return {
    total: tasks.length,
    open,
    done,
    over: open.filter((t) => isOver(t, today)).length,
    today: open.filter((t) => t.due_date === today).length,
    week: open.filter((t) => t.due_date >= today && t.due_date <= in7).length,
    estMin: sumEstimate(open),
    pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    next,
    folders,
  }
}

export interface Progress {
  done: number
  total: number
}

/** Avanzamento delle collegate di una task (null se non ne ha). */
export function linkProgress(taskId: string, idx: LinkIndex, byId: Map<string, Task>): Progress | null {
  const kids = (idx.children.get(taskId) ?? []).map((id) => byId.get(id)).filter((t): t is Task => !!t)
  if (!kids.length) return null
  return { done: kids.filter((t) => t.status === 'done').length, total: kids.length }
}

export function childrenOf(taskId: string, idx: LinkIndex, byId: Map<string, Task>): Task[] {
  return (idx.children.get(taskId) ?? []).map((id) => byId.get(id)).filter((t): t is Task => !!t)
}

/** Le task (ancora aperte) per cui questa serve: etichetta "per: …". */
export function openParents(taskId: string, idx: LinkIndex, byId: Map<string, Task>): Task[] {
  return (idx.parents.get(taskId) ?? [])
    .map((id) => byId.get(id))
    .filter((t): t is Task => !!t && t.status !== 'done')
}

/**
 * Principali che diventano "pronte" quando `taskId` è completata: aperte e con tutte le collegate fatte.
 * `byId` deve già riflettere il completamento.
 */
export function readyParents(taskId: string, idx: LinkIndex, byId: Map<string, Task>): Task[] {
  return openParents(taskId, idx, byId).filter((p) =>
    childrenOf(p.id, idx, byId).every((c) => c.status === 'done'),
  )
}

export function checklistProgress(t: Pick<Task, 'checklist'>): Progress | null {
  if (!t.checklist.length) return null
  return { done: t.checklist.filter((c) => c.done).length, total: t.checklist.length }
}
