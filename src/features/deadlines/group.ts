import { addDaysISO } from '@/lib/dates'
import { isOver } from '@/lib/filters'
import type { Task } from '@/lib/types'

export type DeadlineGroupId = 'over' | 'today' | 'tomorrow' | 'week' | 'later' | 'nodate'

export interface DeadlineGroup {
  id: DeadlineGroupId
  label: string
  color: string
  items: Task[]
}

export const DEADLINE_GROUPS: Omit<DeadlineGroup, 'items'>[] = [
  { id: 'over', label: 'In ritardo', color: '#f0435a' },
  { id: 'today', label: 'Oggi', color: '#ffb020' },
  { id: 'tomorrow', label: 'Domani', color: '#ff6eb4' },
  { id: 'week', label: 'Entro 7 giorni', color: '#7fa6ff' },
  { id: 'later', label: 'Più avanti', color: '#3ddc97' },
  { id: 'nodate', label: 'Senza scadenza', color: '#8e8e99' },
]

const byDue = (a: Task, b: Task) =>
  `${a.due_date || ''}${a.due_time ?? '99'}`.localeCompare(`${b.due_date || ''}${b.due_time ?? '99'}`) ||
  a.priority - b.priority

/**
 * Raggruppa le task aperte per scadenza.
 * horizon = numero di giorni (modulo In scadenza) oppure 'all' (pannello azienda: niente limite
 * e gruppo "Senza scadenza"). Restituisce solo i gruppi non vuoti, nell'ordine fisso.
 */
export function groupDeadlines(tasks: Task[], today: string, horizon: number | 'all'): DeadlineGroup[] {
  const d1 = addDaysISO(today, 1)
  const d7 = addDaysISO(today, 7)
  const end = horizon === 'all' ? '9999-12-31' : addDaysISO(today, horizon)
  const open = tasks.filter((t) => t.status !== 'done')
  const pick: Record<DeadlineGroupId, (t: Task) => boolean> = {
    over: (t) => isOver(t, today),
    today: (t) => t.due_date === today,
    tomorrow: (t) => t.due_date === d1,
    week: (t) => !!t.due_date && t.due_date > d1 && t.due_date <= d7,
    later: (t) => !!t.due_date && t.due_date > d7 && t.due_date <= end,
    nodate: (t) => horizon === 'all' && !t.due_date,
  }
  return DEADLINE_GROUPS.map((g) => ({ ...g, items: open.filter(pick[g.id]).sort(byDue) })).filter(
    (g) => g.items.length,
  )
}

/** Righe piatte (intestazioni + task) per la lista virtualizzata. */
export type DeadlineRow =
  { kind: 'header'; group: DeadlineGroup } | { kind: 'task'; task: Task; group: DeadlineGroup }

export function flattenGroups(groups: DeadlineGroup[]): DeadlineRow[] {
  return groups.flatMap((g) => [
    { kind: 'header' as const, group: g },
    ...g.items.map((task) => ({ kind: 'task' as const, task, group: g })),
  ])
}
