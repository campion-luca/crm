import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import type { Change, LinkPair } from '@/data/changes'
import { useApply, useSnapshotGetter } from '@/data/queries'
import type { DataView } from '@/data/view'
import { fmtDayMonth, todayISO } from '@/lib/dates'
import { newId } from '@/lib/format'
import { statusDef } from '@/lib/priority'
import { childrenOf, readyParents } from '@/lib/stats'
import type { ChecklistItem, Priority, Task, TaskStatus } from '@/lib/types'
import { openModal } from '@/stores/modals'
import { useUi } from '@/stores/ui'

export type DropTarget =
  | { kind: 'status'; status: TaskStatus }
  | { kind: 'day'; date: string }
  | { kind: 'company'; companyId: string }
  | { kind: 'folder'; folderId: string }

/** Campi modificabili dalla modale. */
export interface TaskFields {
  title: string
  company_id: string
  folder_id: string | null
  priority: Priority
  status: TaskStatus
  due_date: string
  due_time: string | null
  estimate_min: number
  link: string
  notes: string
  checklist: ChecklistItem[]
}

/** Cambio di stato con completed_at esplicito: l'orario è quello della spunta anche se si sincronizza dopo. */
export const statusPatch = (status: TaskStatus, prev?: Task) => ({
  status,
  completed_at:
    status === 'done' ? (prev?.status === 'done' ? prev.completed_at : new Date().toISOString()) : null,
})

export function newTaskRow(fields: TaskFields, id: string = newId()): Task {
  const now = new Date().toISOString()
  return {
    id,
    user_id: '',
    ...fields,
    title: fields.title.trim(),
    completed_at: fields.status === 'done' ? now : null,
    created_at: now,
    updated_at: now,
  }
}

const FIELD_KEYS: (keyof TaskFields)[] = [
  'title',
  'company_id',
  'folder_id',
  'priority',
  'status',
  'due_date',
  'due_time',
  'estimate_min',
  'link',
  'notes',
  'checklist',
]

function diffFields(original: Task, fields: TaskFields): Partial<Task> {
  const patch: Partial<Task> = {}
  for (const k of FIELD_KEYS) {
    const a = original[k]
    const b = fields[k]
    if (JSON.stringify(a) !== JSON.stringify(b)) (patch as Record<string, unknown>)[k] = b
  }
  if ('status' in patch) Object.assign(patch, statusPatch(fields.status, original))
  return patch
}

type ApplyFn = ReturnType<typeof useApply>

/** Avvisa se completare queste task ha reso "pronta" una principale (toast "Completa anche questa"). */
function notifyReadyParents(getView: () => DataView, apply: ApplyFn, doneIds: string[]) {
  const v = getView()
  const ready = new Map<string, Task>()
  for (const id of doneIds) for (const p of readyParents(id, v.linkIdx, v.taskById)) ready.set(p.id, p)
  for (const p of ready.values()) {
    toast(`Tutte le collegate di «${p.title}» sono fatte`, {
      duration: 7000,
      action: {
        label: 'Completa anche questa',
        onClick: () => {
          const cur = getView().taskById.get(p.id)
          if (!cur || cur.status === 'done') return
          apply([{ op: 'patch', table: 'tasks', id: p.id, patch: statusPatch('done', cur) }], {
            message: 'Spostata in Completi',
            undo: true,
          })
          notifyReadyParents(getView, apply, [p.id])
        },
      },
    })
  }
}

export function useTaskActions() {
  const apply = useApply()
  const getView = useSnapshotGetter()

  const notifyReady = useCallback(
    (doneIds: string[]) => notifyReadyParents(getView, apply, doneIds),
    [apply, getView],
  )

  const openChildren = (v: DataView, id: string) =>
    childrenOf(id, v.linkIdx, v.taskById).filter((c) => c.status !== 'done')

  return useMemo(() => {
    const patchTask = (id: string, patch: Partial<Task>): Change => ({
      op: 'patch',
      table: 'tasks',
      id,
      patch,
    })

    /** Spunta dalle liste: chiede conferma se mancano collegate, poi sposta in Completi. */
    function toggleDone(taskId: string) {
      const v = getView()
      const t = v.taskById.get(taskId)
      if (!t) return
      if (t.status === 'done') {
        apply([patchTask(t.id, statusPatch('todo', t))], { message: 'Riaperta', undo: true })
        return
      }
      if (openChildren(v, t.id).length) {
        openModal({ kind: 'completeLinked', taskId: t.id })
        return
      }
      apply([patchTask(t.id, statusPatch('done', t))], { message: 'Spostata in Completi', undo: true })
      notifyReady([t.id])
    }

    function completeLinked(taskId: string, mode: 'all' | 'only') {
      const v = getView()
      const t = v.taskById.get(taskId)
      if (!t) return
      const kids = mode === 'all' ? openChildren(v, t.id) : []
      apply(
        [
          ...kids.map((k) => patchTask(k.id, statusPatch('done', k))),
          patchTask(t.id, statusPatch('done', t)),
        ],
        {
          message: mode === 'all' ? 'Completata con tutte le collegate' : 'Spostata in Completi',
          undo: true,
        },
      )
      notifyReady([t.id])
    }

    /** Spunta di una collegata dentro la modale: nessun toast, la modale resta aperta. */
    function toggleChild(childId: string) {
      const t = getView().taskById.get(childId)
      if (!t) return
      const next = t.status === 'done' ? 'todo' : 'done'
      apply([patchTask(t.id, statusPatch(next, t))])
    }

    function moveTask(taskId: string, target: DropTarget) {
      const v = getView()
      const t = v.taskById.get(taskId)
      if (!t) return
      switch (target.kind) {
        case 'status': {
          if (t.status === target.status) return
          apply([patchTask(t.id, statusPatch(target.status, t))], {
            message: `Spostato in ${statusDef(target.status).label}`,
            undo: true,
          })
          if (target.status === 'done') notifyReady([t.id])
          return
        }
        case 'day': {
          if (t.due_date === target.date) return
          apply([patchTask(t.id, { due_date: target.date })], {
            message: `Scadenza: ${fmtDayMonth(target.date)}`,
            undo: true,
          })
          useUi.getState().selectDay(target.date)
          return
        }
        case 'company': {
          const c = v.companyById.get(target.companyId)
          if (!c || (t.company_id === c.id && !t.folder_id)) return
          apply([patchTask(t.id, { company_id: c.id, folder_id: null })], {
            message: `Spostato in ${c.name}`,
            undo: true,
          })
          return
        }
        case 'folder': {
          const f = v.folderById.get(target.folderId)
          if (!f || t.folder_id === f.id) return
          apply([patchTask(t.id, { folder_id: f.id, company_id: f.company_id })], {
            message: `Spostato in ${f.name}`,
            undo: true,
          })
          return
        }
      }
    }

    /**
     * Salva la modale: crea o aggiorna la task (solo i campi cambiati) e allinea le collegate.
     * Restituisce l'id della task.
     */
    function saveTask(
      input: { id: string; isNew: boolean; fields: TaskFields; linkedIds: string[] },
      opts: { silent?: boolean } = {},
    ): string {
      const v = getView()
      const original = input.isNew ? undefined : v.taskById.get(input.id)
      const changes: Change[] = []
      const fields = { ...input.fields, checklist: input.fields.checklist.filter((c) => c.text.trim()) }
      if (!original) changes.push({ op: 'upsert', table: 'tasks', rows: [newTaskRow(fields, input.id)] })
      else {
        const patch = diffFields(original, fields)
        if (Object.keys(patch).length) changes.push(patchTask(original.id, patch))
      }
      const saved = new Set(v.linkIdx.children.get(input.id) ?? [])
      const next = new Set(input.linkedIds.filter((id) => v.taskById.has(id) && id !== input.id))
      const removed: LinkPair[] = [...saved]
        .filter((c) => !next.has(c))
        .map((c) => ({ parent_id: input.id, child_id: c }))
      const added: LinkPair[] = [...next]
        .filter((c) => !saved.has(c))
        .map((c) => ({ parent_id: input.id, child_id: c }))
      if (removed.length) changes.push({ op: 'delete', table: 'task_links', keys: removed })
      if (added.length) changes.push({ op: 'upsert', table: 'task_links', rows: added })
      apply(changes, opts.silent ? {} : { message: 'Salvato' })
      if (fields.status === 'done' && original?.status !== 'done') notifyReady([input.id])
      return input.id
    }

    /** "+ Nuova task collegata": la crea subito con azienda, cartella, priorità e scadenza della principale. */
    function createLinkedTask(
      title: string,
      parent: Pick<TaskFields, 'company_id' | 'folder_id' | 'priority' | 'due_date'>,
    ) {
      const row = newTaskRow({
        title,
        company_id: parent.company_id,
        folder_id: parent.folder_id,
        priority: parent.priority,
        status: 'todo',
        due_date: parent.due_date || todayISO(),
        due_time: null,
        estimate_min: 0,
        link: '',
        notes: '',
        checklist: [],
      })
      apply([{ op: 'upsert', table: 'tasks', rows: [row] }])
      return row.id
    }

    /** Duplica: stato da fare, niente collegate, checklist azzerata. Restituisce l'id della copia. */
    function duplicateTask(fields: TaskFields): string {
      const copy = newTaskRow({
        ...fields,
        title: `${fields.title.trim()} (copia)`.slice(0, 300),
        status: 'todo',
        checklist: fields.checklist
          .filter((c) => c.text.trim())
          .map((c) => ({ id: newId(), text: c.text, done: false })),
      })
      apply([{ op: 'upsert', table: 'tasks', rows: [copy] }], { message: 'Duplicato' })
      return copy.id
    }

    function deleteTask(taskId: string) {
      apply([{ op: 'delete', table: 'tasks', ids: [taskId] }], { message: 'Lavoro eliminato', undo: true })
    }

    return {
      toggleDone,
      completeLinked,
      toggleChild,
      moveTask,
      saveTask,
      createLinkedTask,
      duplicateTask,
      deleteTask,
    }
  }, [apply, getView, notifyReady])
}
