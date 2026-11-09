import { addDaysISO } from './dates'
import type { DueFilter, Scope, Task } from './types'

export const isOpen = (t: Pick<Task, 'status'>) => t.status !== 'done'
export const isOver = (t: Pick<Task, 'status' | 'due_date'>, today: string) =>
  t.status !== 'done' && !!t.due_date && t.due_date < today

export const inScope = (t: Pick<Task, 'company_id' | 'folder_id'>, s: Scope) =>
  (!s.companyId || t.company_id === s.companyId) && (!s.folderId || t.folder_id === s.folderId)

export function matchesDue(t: Task, due: DueFilter, today: string): boolean {
  switch (due) {
    case 'over':
      return isOver(t, today)
    case 'today':
      return t.due_date === today && t.status !== 'done'
    case 'week':
      return t.due_date >= today && t.due_date <= addDaysISO(today, 7) && t.status !== 'done'
    case 'doing':
      return t.status === 'doing'
  }
}

export interface TaskFilters {
  q?: string | undefined
  prio?: number | undefined
  due?: DueFilter | undefined
  showDone: boolean
}

export interface FilterContext {
  today: string
  companyName: (id: string) => string
  folderName: (id: string | null) => string
  /** il calendario ignora il filtro "scadenza" dei tile di riepilogo */
  ignoreDue?: boolean
}

/** Filtri della toolbar: ricerca testuale, priorità, tile di riepilogo, mostra completati. */
export function filterTasks(tasks: Task[], f: TaskFilters, ctx: FilterContext): Task[] {
  const q = (f.q ?? '').trim().toLowerCase()
  return tasks.filter((t) => {
    if (q) {
      const hay =
        `${t.title} ${t.notes} ${ctx.companyName(t.company_id)} ${ctx.folderName(t.folder_id)}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (f.prio && t.priority !== f.prio) return false
    if (!f.showDone && t.status === 'done') return false
    if (!ctx.ignoreDue && f.due && !matchesDue(t, f.due, ctx.today)) return false
    return true
  })
}

const dueKey = (t: Task) => `${t.due_date || '9999-12-31'}${t.due_time ?? ''}`

/** Ordine standard: aperte prima, poi priorità, poi scadenza (data + ora), poi creazione. */
export function compareTasks(a: Task, b: Task): number {
  return (
    Number(a.status === 'done') - Number(b.status === 'done') ||
    a.priority - b.priority ||
    dueKey(a).localeCompare(dueKey(b)) ||
    a.created_at.localeCompare(b.created_at)
  )
}

export const sortTasks = (tasks: Task[]): Task[] => [...tasks].sort(compareTasks)

/** Ordine per orario nella cella del calendario (le task senza ora vanno in fondo). */
export const compareByTime = (a: Task, b: Task) =>
  (a.due_time ?? '99').localeCompare(b.due_time ?? '99') || compareTasks(a, b)

export interface SummaryCounts {
  over: number
  today: number
  week: number
  doing: number
}

export function summaryCounts(tasks: Task[], today: string): SummaryCounts {
  const out: SummaryCounts = { over: 0, today: 0, week: 0, doing: 0 }
  for (const t of tasks) {
    for (const k of ['over', 'today', 'week', 'doing'] as const) if (matchesDue(t, k, today)) out[k]++
  }
  return out
}

export const sumEstimate = (tasks: Task[]) => tasks.reduce((a, t) => a + (t.estimate_min || 0), 0)
