import { linkKey } from '@/lib/cycles'
import { emptyBrand } from '@/lib/brand'
import { emptyProfile } from '@/lib/profile'
import type { Company, Folder, Snapshot, Task, TaskLink } from '@/lib/types'

/** Fixture condivise per i test della logica pura. */

export const TEST_USER = 'u1'
export const TEST_TS = '2026-11-01T09:00:00.000Z'

let seq = 0
const autoId = (prefix: string) => `${prefix}-${++seq}`

/** makeId deterministico: 'id-1', 'id-2', … */
export function counterIds(prefix = 'id'): () => string {
  let n = 0
  return () => `${prefix}-${++n}`
}

export function makeCompany(p: Partial<Company> = {}): Company {
  return {
    id: autoId('company'),
    user_id: TEST_USER,
    name: 'Azienda',
    color: '#ffe08a',
    position: 0,
    profile: emptyProfile(),
    brand: emptyBrand(),
    created_at: TEST_TS,
    ...p,
  }
}

export function makeFolder(p: Partial<Folder> = {}): Folder {
  return {
    id: autoId('folder'),
    user_id: TEST_USER,
    company_id: 'company-x',
    name: 'Cartella',
    position: 0,
    created_at: TEST_TS,
    ...p,
  }
}

/** Le task "done" ricevono un completed_at di default, come farebbe il trigger del DB. */
export function makeTask(p: Partial<Task> = {}): Task {
  const status = p.status ?? 'todo'
  return {
    id: autoId('task'),
    user_id: TEST_USER,
    company_id: 'company-x',
    folder_id: null,
    title: 'Task',
    notes: '',
    link: '',
    priority: 3,
    status,
    due_date: '2026-11-06',
    due_time: null,
    estimate_min: 0,
    checklist: [],
    completed_at: status === 'done' ? TEST_TS : null,
    created_at: TEST_TS,
    updated_at: TEST_TS,
    ...p,
  }
}

export const makeLink = (parent_id: string, child_id: string, user_id = TEST_USER): TaskLink => ({
  parent_id,
  child_id,
  user_id,
})

export function snapshotOf(p: Partial<Snapshot> = {}): Snapshot {
  return { companies: [], folders: [], tasks: [], links: [], ...p }
}

const byId = <T extends { id: string }>(rows: T[]): T[] => [...rows].sort((a, b) => a.id.localeCompare(b.id))

/**
 * Forma confrontabile di uno snapshot: righe ordinate per id/chiave e senza updated_at
 * (che applyChanges rinnova a ogni scrittura).
 */
export function normalizeSnapshot(s: Snapshot) {
  return {
    companies: byId(s.companies),
    folders: byId(s.folders),
    tasks: byId(s.tasks).map(({ updated_at: _u, ...rest }) => rest),
    links: [...s.links].sort((a, b) => linkKey(a).localeCompare(linkKey(b))),
  }
}

export const byIdMap = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]))
