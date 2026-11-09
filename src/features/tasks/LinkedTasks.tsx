import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { useData } from '@/data/queries'
import { ancestorsOf } from '@/lib/cycles'
import { fmtDue } from '@/lib/dates'
import { sortTasks } from '@/lib/filters'
import { cn } from '@/lib/format'
import { useToday } from '@/lib/hooks'
import type { Priority } from '@/lib/types'
import { useTaskActions } from './actions'
import { DueTag, PrioPill } from './tags'

interface Props {
  taskId: string
  isNew: boolean
  linkedIds: string[]
  onChange: (ids: string[]) => void
  dueDate: string
  companyId: string
  folderId: string | null
  priority: Priority
  /** apre una collegata (dopo aver salvato la task corrente) */
  onOpen: (id: string) => void
}

/** Sezione "Task collegate": le dipendenze da completare per chiudere questa task. */
export function LinkedTasks({
  taskId,
  isNew,
  linkedIds,
  onChange,
  dueDate,
  companyId,
  folderId,
  priority,
  onOpen,
}: Props) {
  const view = useData()
  const today = useToday()
  const { toggleChild, createLinkedTask } = useTaskActions()
  const [newTitle, setNewTitle] = useState('')

  const linked = linkedIds.map((id) => view.taskById.get(id)).filter((t) => !!t)
  const done = linked.filter((t) => t.status === 'done').length

  // candidati: aperte, non se stessa, non già collegate, non antenati (niente cicli)
  const groups = useMemo(() => {
    const bad = isNew ? new Set<string>() : ancestorsOf(taskId, view.linkIdx)
    bad.add(taskId)
    for (const id of linkedIds) bad.add(id)
    const cand = view.tasks.filter((t) => t.status !== 'done' && !bad.has(t.id))
    const companies = [...view.companies].sort(
      (a, b) => Number(b.id === companyId) - Number(a.id === companyId),
    )
    return companies
      .map((c) => ({ company: c, tasks: sortTasks(cand.filter((t) => t.company_id === c.id)) }))
      .filter((g) => g.tasks.length)
  }, [view, taskId, isNew, linkedIds, companyId])

  const addNew = () => {
    const title = newTitle.trim()
    if (!title) return
    const id = createLinkedTask(title, {
      company_id: companyId,
      folder_id: folderId,
      priority,
      due_date: dueDate,
    })
    onChange([...linkedIds, id])
    setNewTitle('')
  }

  return (
    <div className="flex flex-col gap-[5px] rounded-xl border border-line bg-surface-2 p-3">
      <span className="field-label">
        Task collegate <span className="text-xs text-ink-3">· da completare per chiudere questa</span>
      </span>
      <div className="flex flex-col gap-1.5">
        {!linked.length ? (
          <span className="text-xs text-ink-3">
            Nessuna. Es. per una call: prepara slide, invia invito, raccogli dati.
          </span>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-2.5">
              <div
                className="h-[7px] flex-1 overflow-hidden rounded-full bg-surface"
                role="progressbar"
                aria-label="Collegate completate"
                aria-valuemin={0}
                aria-valuemax={linked.length}
                aria-valuenow={done}
              >
                <span
                  className="block h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${Math.round((done / linked.length) * 100)}%` }}
                />
              </div>
              <span className="num text-xs text-ink-3">
                {done}/{linked.length}
              </span>
            </div>
            {linked.map((x) => {
              const c = view.companyById.get(x.company_id)
              const isDone = x.status === 'done'
              const late = !!dueDate && x.due_date > dueDate && !isDone
              return (
                <div
                  key={x.id}
                  className="flex items-center gap-2 rounded-[10px] border border-line bg-surface px-2 py-1.5"
                >
                  <Checkbox
                    checked={isDone}
                    onChange={() => toggleChild(x.id)}
                    label={isDone ? `Riapri la collegata: ${x.title}` : `Completa la collegata: ${x.title}`}
                  />
                  <button
                    type="button"
                    onClick={() => onOpen(x.id)}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-[7px] p-0.5 text-left font-medium hover:text-accent',
                      isDone && 'text-ink-3 line-through',
                    )}
                  >
                    <span
                      className="size-2 shrink-0 rounded-[2px]"
                      style={{ background: c?.color }}
                      aria-hidden
                    />
                    <span className="truncate">{x.title}</span>
                  </button>
                  {late && (
                    <span
                      title="Scade dopo questa task"
                      className="rounded-full bg-[rgba(255,93,115,.14)] px-2 py-[3px] text-[11.5px] font-semibold whitespace-nowrap text-danger-ink"
                    >
                      scade dopo
                    </span>
                  )}
                  <PrioPill p={x.priority} />
                  <DueTag task={x} today={today} />
                  <button
                    type="button"
                    title="Scollega"
                    aria-label={`Scollega ${x.title}`}
                    onClick={() => onChange(linkedIds.filter((id) => id !== x.id))}
                    className="hit-slop grid size-[22px] place-items-center rounded-[5px] text-ink-3 hover:bg-surface-2 hover:text-danger [&_svg]:size-3.5"
                  >
                    <X />
                  </button>
                </div>
              )
            })}
          </>
        )}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-3 mobile:grid-cols-1">
        <select
          aria-label="Collega una task esistente"
          className="input"
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...linkedIds, e.target.value])
          }}
        >
          <option value="">+ Collega una task esistente…</option>
          {groups.map((g) => (
            <optgroup key={g.company.id} label={g.company.name}>
              {g.tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.due_date ? ` · ${fmtDue(t.due_date, t.due_time, today)}` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          className="input"
          aria-label="Nuova task collegata"
          placeholder="+ Nuova task collegata, poi Invio"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addNew()
            }
          }}
        />
      </div>
    </div>
  )
}
