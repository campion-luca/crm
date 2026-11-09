import { indexLinks, type LinkIndex } from '@/lib/cycles'
import type { Company, Folder, Snapshot, Task } from '@/lib/types'
import { emptySnapshot } from '@/lib/types'

/** Snapshot + indici derivati, calcolati una sola volta per ogni versione dei dati. */
export interface DataView extends Snapshot {
  companyById: Map<string, Company>
  folderById: Map<string, Folder>
  taskById: Map<string, Task>
  linkIdx: LinkIndex
  foldersOf: (companyId: string) => Folder[]
  tasksOf: (companyId: string) => Task[]
  companyName: (id: string) => string
  folderName: (id: string | null) => string
}

const cache = new WeakMap<Snapshot, DataView>()

export function viewOf(s: Snapshot): DataView {
  const hit = cache.get(s)
  if (hit) return hit
  const companyById = new Map(s.companies.map((c) => [c.id, c]))
  const folderById = new Map(s.folders.map((f) => [f.id, f]))
  const taskById = new Map(s.tasks.map((t) => [t.id, t]))
  const foldersBy = new Map<string, Folder[]>()
  for (const f of s.folders) {
    const arr = foldersBy.get(f.company_id)
    if (arr) arr.push(f)
    else foldersBy.set(f.company_id, [f])
  }
  const tasksBy = new Map<string, Task[]>()
  for (const t of s.tasks) {
    const arr = tasksBy.get(t.company_id)
    if (arr) arr.push(t)
    else tasksBy.set(t.company_id, [t])
  }
  const view: DataView = {
    ...s,
    companyById,
    folderById,
    taskById,
    linkIdx: indexLinks(s.links),
    foldersOf: (id) => foldersBy.get(id) ?? [],
    tasksOf: (id) => tasksBy.get(id) ?? [],
    companyName: (id) => companyById.get(id)?.name ?? '',
    folderName: (id) => (id ? (folderById.get(id)?.name ?? '') : ''),
  }
  cache.set(s, view)
  return view
}

const EMPTY = emptySnapshot()
export const emptyView = () => viewOf(EMPTY)
