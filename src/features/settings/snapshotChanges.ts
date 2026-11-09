import type { Change } from '@/data/changes'
import type { Snapshot } from '@/lib/types'

/** Tutte le righe di uno snapshot come upsert, nell'ordine giusto per le FK. */
export function snapshotToChanges(s: Snapshot): Change[] {
  const out: Change[] = []
  if (s.companies.length) out.push({ op: 'upsert', table: 'companies', rows: s.companies })
  if (s.folders.length) out.push({ op: 'upsert', table: 'folders', rows: s.folders })
  if (s.tasks.length) out.push({ op: 'upsert', table: 'tasks', rows: s.tasks })
  if (s.links.length) {
    out.push({
      op: 'upsert',
      table: 'task_links',
      rows: s.links.map((l) => ({ parent_id: l.parent_id, child_id: l.child_id })),
    })
  }
  return out
}
