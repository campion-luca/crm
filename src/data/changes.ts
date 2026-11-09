import { indexLinks, linkKey, wouldCreateCycle } from '@/lib/cycles'
import type { Company, Folder, Snapshot, Task, TaskLink } from '@/lib/types'

/**
 * Una modifica ai dati, nello stesso formato accettato dalla RPC apply_changes.
 * Ogni operazione è idempotente (upsert per id, patch con valori assoluti, delete per id).
 */
export type EntityTable = 'companies' | 'folders' | 'tasks'
export type TableName = EntityTable | 'task_links'
export interface LinkPair {
  parent_id: string
  child_id: string
}

export type Change =
  | { op: 'upsert'; table: 'companies'; rows: Company[] }
  | { op: 'upsert'; table: 'folders'; rows: Folder[] }
  | { op: 'upsert'; table: 'tasks'; rows: Task[] }
  | { op: 'upsert'; table: 'task_links'; rows: LinkPair[] }
  | { op: 'patch'; table: 'companies'; id: string; patch: Partial<Company> }
  | { op: 'patch'; table: 'folders'; id: string; patch: Partial<Folder> }
  | { op: 'patch'; table: 'tasks'; id: string; patch: Partial<Task> }
  | { op: 'delete'; table: EntityTable; ids: string[] }
  | { op: 'delete'; table: 'task_links'; keys: LinkPair[] }

export interface ApplyOptions {
  /** timestamp usato per updated_at / completed_at mancanti */
  now?: string
  /** user_id da assegnare alle righe nuove che non lo hanno */
  userId?: string
  /**
   * strict: rifiuta come farebbe Postgres (FK mancanti, cartella di un'altra azienda, cicli).
   * Usato dal gateway locale. In cache le violazioni vengono semplicemente ignorate.
   */
  strict?: boolean
}

export interface ApplyResult {
  snapshot: Snapshot
  /** modifiche che riportano allo stato precedente (rollback e "Annulla") */
  inverse: Change[]
  /** chiavi `tabella:id` toccate, cascade compresi */
  touched: string[]
}

export class ConstraintError extends Error {}

const rowKey = (table: TableName, id: string) => `${table}:${id}`

type EntityKey = 'companies' | 'folders' | 'tasks'

class Working {
  companies: Company[]
  folders: Folder[]
  tasks: Task[]
  links: TaskLink[]
  private copied = new Set<keyof Snapshot>()

  constructor(s: Snapshot) {
    this.companies = s.companies
    this.folders = s.folders
    this.tasks = s.tasks
    this.links = s.links
  }

  /** copia l'array solo alla prima scrittura: le tabelle non toccate mantengono l'identità */
  edit<K extends keyof Snapshot>(key: K): Snapshot[K] {
    if (!this.copied.has(key)) {
      this.copied.add(key)
      ;(this as unknown as Snapshot)[key] = [...this[key]] as Snapshot[K]
    }
    return this[key]
  }

  snapshot(): Snapshot {
    return { companies: this.companies, folders: this.folders, tasks: this.tasks, links: this.links }
  }
}

/** Emula i trigger: completed_at coerente con lo stato, updated_at aggiornato. */
function finalizeTask(t: Task, now: string): Task {
  const completed_at = t.status === 'done' ? (t.completed_at ?? now) : null
  return completed_at === t.completed_at && t.updated_at === now ? t : { ...t, completed_at, updated_at: now }
}

export function applyChanges(snap: Snapshot, changes: Change[], opts: ApplyOptions = {}): ApplyResult {
  const now = opts.now ?? new Date().toISOString()
  const w = new Working(snap)
  const groups: Change[][] = []
  const touched = new Set<string>()
  const fail = (msg: string) => {
    if (opts.strict) throw new ConstraintError(msg)
  }

  const withUser = <T extends { user_id: string }>(r: T): T =>
    !r.user_id && opts.userId ? { ...r, user_id: opts.userId } : r

  const checkRefs = (table: EntityKey, row: Folder | Task): boolean => {
    if (!opts.strict) return true
    if (!w.companies.some((c) => c.id === row.company_id)) {
      fail(`Azienda ${row.company_id} non trovata`)
      return false
    }
    if (table === 'tasks') {
      const t = row as Task
      if (t.folder_id && !w.folders.some((f) => f.id === t.folder_id && f.company_id === t.company_id)) {
        fail(`Cartella ${t.folder_id} non valida`)
        return false
      }
    }
    return true
  }

  for (const ch of changes) {
    const inv: Change[] = []

    if (ch.op === 'upsert' && ch.table !== 'task_links') {
      const key: EntityKey = ch.table
      const list = w.edit(key) as (Company | Folder | Task)[]
      const index = new Map(list.map((r, i) => [r.id, i]))
      const removed: string[] = []
      const restored: (Company | Folder | Task)[] = []
      // con id ripetuti nello stesso upsert l'inversa deve ricordare solo lo stato di partenza
      const seen = new Set<string>()
      for (const raw of ch.rows) {
        let row = withUser(raw as Company | Folder | Task)
        if (key === 'tasks') row = finalizeTask(row as Task, now)
        if (key !== 'companies' && !checkRefs(key, row as Folder | Task)) continue
        const i = index.get(row.id)
        if (i === undefined) {
          index.set(row.id, list.length)
          list.push(row)
          removed.push(row.id)
        } else {
          if (!seen.has(row.id)) restored.push(list[i]!)
          list[i] = row
        }
        seen.add(row.id)
        touched.add(rowKey(key, row.id))
      }
      if (removed.length) inv.push({ op: 'delete', table: key, ids: removed })
      if (restored.length) inv.push({ op: 'upsert', table: key, rows: restored } as Change)
    } else if (ch.op === 'upsert') {
      const idx = indexLinks(w.links)
      const existing = new Set(w.links.map(linkKey))
      const added: LinkPair[] = []
      for (const pair of ch.rows) {
        const k = linkKey(pair)
        if (existing.has(k)) continue
        if (opts.strict) {
          if (!w.tasks.some((t) => t.id === pair.parent_id) || !w.tasks.some((t) => t.id === pair.child_id)) {
            fail('Task non trovata')
          }
        }
        if (wouldCreateCycle(pair.parent_id, pair.child_id, idx)) {
          fail('Collegamento non valido: creerebbe un ciclo')
          continue
        }
        w.edit('links').push({
          parent_id: pair.parent_id,
          child_id: pair.child_id,
          user_id: opts.userId ?? '',
        })
        existing.add(k)
        const kids = idx.children.get(pair.parent_id)
        if (kids) kids.push(pair.child_id)
        else idx.children.set(pair.parent_id, [pair.child_id])
        added.push({ parent_id: pair.parent_id, child_id: pair.child_id })
        touched.add(rowKey('task_links', k))
      }
      if (added.length) inv.push({ op: 'delete', table: 'task_links', keys: added })
    } else if (ch.op === 'patch') {
      const key: EntityKey = ch.table
      const list = w[key] as (Company | Folder | Task)[]
      const i = list.findIndex((r) => r.id === ch.id)
      if (i >= 0) {
        const old = list[i]!
        let next = { ...old, ...ch.patch, id: old.id, user_id: old.user_id } as Company | Folder | Task
        if (key === 'tasks') next = finalizeTask(next as Task, now)
        if (key === 'companies' || checkRefs(key, next as Folder | Task)) {
          const keys = new Set(Object.keys(ch.patch))
          if (key === 'tasks' && (old as Task).completed_at !== (next as Task).completed_at)
            keys.add('completed_at')
          keys.delete('id')
          keys.delete('user_id')
          keys.delete('updated_at')
          const back: Record<string, unknown> = {}
          for (const k of keys) back[k] = (old as unknown as Record<string, unknown>)[k]
          ;(w.edit(key) as (Company | Folder | Task)[])[i] = next
          inv.push({ op: 'patch', table: key, id: ch.id, patch: back } as Change)
          touched.add(rowKey(key, ch.id))
        }
      }
    } else if (ch.table === 'task_links') {
      const keys = new Set(ch.keys.map(linkKey))
      const gone = w.links.filter((l) => keys.has(linkKey(l)))
      if (gone.length) {
        w.links = w.links.filter((l) => !keys.has(linkKey(l)))
        inv.push({ op: 'upsert', table: 'task_links', rows: gone.map(pairOf) })
        for (const l of gone) touched.add(rowKey('task_links', linkKey(l)))
      }
    } else {
      // delete con gli stessi cascade dello schema
      const ids = new Set(ch.ids)
      if (ch.table === 'companies') {
        const companies = w.companies.filter((c) => ids.has(c.id))
        const folders = w.folders.filter((f) => ids.has(f.company_id))
        const tasks = w.tasks.filter((t) => ids.has(t.company_id))
        const taskIds = new Set(tasks.map((t) => t.id))
        const links = w.links.filter((l) => taskIds.has(l.parent_id) || taskIds.has(l.child_id))
        if (companies.length) {
          w.companies = w.companies.filter((c) => !ids.has(c.id))
          w.folders = w.folders.filter((f) => !ids.has(f.company_id))
          w.tasks = w.tasks.filter((t) => !taskIds.has(t.id))
          w.links = w.links.filter((l) => !links.includes(l))
          inv.push({ op: 'upsert', table: 'companies', rows: companies })
          if (folders.length) inv.push({ op: 'upsert', table: 'folders', rows: folders })
          if (tasks.length) inv.push({ op: 'upsert', table: 'tasks', rows: tasks })
          if (links.length) inv.push({ op: 'upsert', table: 'task_links', rows: links.map(pairOf) })
          companies.forEach((c) => touched.add(rowKey('companies', c.id)))
          folders.forEach((f) => touched.add(rowKey('folders', f.id)))
          tasks.forEach((t) => touched.add(rowKey('tasks', t.id)))
          links.forEach((l) => touched.add(rowKey('task_links', linkKey(l))))
        }
      } else if (ch.table === 'folders') {
        const folders = w.folders.filter((f) => ids.has(f.id))
        if (folders.length) {
          w.folders = w.folders.filter((f) => !ids.has(f.id))
          inv.push({ op: 'upsert', table: 'folders', rows: folders })
          folders.forEach((f) => touched.add(rowKey('folders', f.id)))
          // on delete set null
          w.tasks = w.tasks.map((t) => {
            if (!t.folder_id || !ids.has(t.folder_id)) return t
            inv.push({ op: 'patch', table: 'tasks', id: t.id, patch: { folder_id: t.folder_id } })
            touched.add(rowKey('tasks', t.id))
            return { ...t, folder_id: null, updated_at: now }
          })
        }
      } else {
        const tasks = w.tasks.filter((t) => ids.has(t.id))
        const links = w.links.filter((l) => ids.has(l.parent_id) || ids.has(l.child_id))
        if (tasks.length) {
          w.tasks = w.tasks.filter((t) => !ids.has(t.id))
          w.links = w.links.filter((l) => !links.includes(l))
          inv.push({ op: 'upsert', table: 'tasks', rows: tasks })
          if (links.length) inv.push({ op: 'upsert', table: 'task_links', rows: links.map(pairOf) })
          tasks.forEach((t) => touched.add(rowKey('tasks', t.id)))
          links.forEach((l) => touched.add(rowKey('task_links', linkKey(l))))
        }
      }
    }

    groups.push(inv)
  }

  return { snapshot: w.snapshot(), inverse: groups.reverse().flat(), touched: [...touched] }
}

const pairOf = (l: LinkPair): LinkPair => ({ parent_id: l.parent_id, child_id: l.child_id })

/** Chiavi che una modifica in arrivo (es. da Realtime) andrebbe a toccare, senza cascade. */
export function changeKeys(ch: Change): string[] {
  if (ch.op === 'upsert') {
    return ch.table === 'task_links'
      ? ch.rows.map((r) => rowKey('task_links', linkKey(r)))
      : ch.rows.map((r) => rowKey(ch.table, r.id))
  }
  if (ch.op === 'patch') return [rowKey(ch.table, ch.id)]
  return ch.table === 'task_links'
    ? ch.keys.map((k) => rowKey('task_links', linkKey(k)))
    : ch.ids.map((id) => rowKey(ch.table, id))
}

/** Toglie da una modifica le righe con chiave in `skip` (modifiche locali ancora in volo). */
export function withoutKeys(ch: Change, skip: (key: string) => boolean): Change | null {
  if (ch.op === 'upsert') {
    const rows =
      ch.table === 'task_links'
        ? ch.rows.filter((r) => !skip(rowKey('task_links', linkKey(r))))
        : (ch.rows as { id: string }[]).filter((r) => !skip(rowKey(ch.table, r.id)))
    return rows.length ? ({ ...ch, rows } as Change) : null
  }
  if (ch.op === 'patch') return skip(rowKey(ch.table, ch.id)) ? null : ch
  if (ch.table === 'task_links') {
    const keys = ch.keys.filter((k) => !skip(rowKey('task_links', linkKey(k))))
    return keys.length ? { ...ch, keys } : null
  }
  const ids = ch.ids.filter((id) => !skip(rowKey(ch.table, id)))
  return ids.length ? { ...ch, ids } : null
}

/**
 * Dopo un refetch, le righe con modifiche locali ancora in volo restano come in cache
 * (presenti o assenti), così l'optimistic update non "rimbalza".
 */
export function mergePending(fresh: Snapshot, current: Snapshot | undefined, pending: Set<string>): Snapshot {
  if (!current || !pending.size) return fresh
  const merge = <T>(table: TableName, freshRows: T[], curRows: T[], key: (r: T) => string): T[] => {
    const isPending = (r: T) => pending.has(rowKey(table, key(r)))
    const keep = curRows.filter(isPending)
    const keepKeys = new Set(keep.map(key))
    const out = freshRows.filter((r) => !isPending(r) || keepKeys.has(key(r)))
    const outIdx = new Map(out.map((r, i) => [key(r), i]))
    for (const r of keep) {
      const i = outIdx.get(key(r))
      if (i === undefined) out.push(r)
      else out[i] = r
    }
    return out
  }
  return {
    companies: merge('companies', fresh.companies, current.companies, (r) => r.id),
    folders: merge('folders', fresh.folders, current.folders, (r) => r.id),
    tasks: merge('tasks', fresh.tasks, current.tasks, (r) => r.id),
    links: merge('task_links', fresh.links, current.links, linkKey),
  }
}
