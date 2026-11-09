import type { DataView } from '@/data/view'
import type { Company, Folder, Task } from '@/lib/types'

/** Dati derivati di una task, tutti primitivi o oggetti stabili: le righe memoizzate non si ridisegnano a vuoto. */
export interface TaskMeta {
  company: Company | undefined
  folder: Folder | undefined
  linkDone: number
  linkTotal: number
  forTitle: string
  forMore: number
}

export function taskMeta(task: Task, view: DataView): TaskMeta {
  const kids = view.linkIdx.children.get(task.id) ?? []
  let linkDone = 0
  let linkTotal = 0
  for (const id of kids) {
    const k = view.taskById.get(id)
    if (!k) continue
    linkTotal++
    if (k.status === 'done') linkDone++
  }
  const parents = (view.linkIdx.parents.get(task.id) ?? [])
    .map((id) => view.taskById.get(id))
    .filter((p): p is Task => !!p && p.status !== 'done')
  return {
    company: view.companyById.get(task.company_id),
    folder: task.folder_id ? view.folderById.get(task.folder_id) : undefined,
    linkDone,
    linkTotal,
    forTitle: parents[0]?.title ?? '',
    forMore: Math.max(0, parents.length - 1),
  }
}
