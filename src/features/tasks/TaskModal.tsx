import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button, ConfirmButton } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Kbd } from '@/components/ui/Module'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'
import { useData } from '@/data/queries'
import { todayISO } from '@/lib/dates'
import { cn, newId } from '@/lib/format'
import { PRIOS, STATI, toPriority } from '@/lib/priority'
import { normUrl } from '@/lib/profile'
import type { ChecklistItem, Priority, TaskStatus } from '@/lib/types'
import { closeModal, openModal, type TaskPreset } from '@/stores/modals'
import { useUi } from '@/stores/ui'
import { useCompanyActions } from '@/features/companies/actions'
import { useTaskActions, type TaskFields } from './actions'
import { LinkedTasks } from './LinkedTasks'

const NEW_FOLDER = '__new'

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Dai un titolo al lavoro')
    .max(300, 'Titolo troppo lungo (max 300 caratteri)'),
  company_id: z.string().min(1, "Scegli un'azienda"),
  folder_id: z.string(),
  priority: z.number().int().min(1).max(5),
  status: z.enum(['todo', 'doing', 'review', 'done']),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ogni task ha bisogno di una scadenza'),
  due_time: z.string().regex(/^(\d{2}:\d{2})?$/, 'Ora non valida'),
  estimate_min: z.number().int().min(0, 'La stima non può essere negativa'),
  link: z.string().trim().max(2000),
  notes: z.string().max(20000),
})
type FormValues = z.infer<typeof schema>

const toFields = (v: FormValues, checklist: ChecklistItem[]): TaskFields => ({
  title: v.title.trim(),
  company_id: v.company_id,
  folder_id: v.folder_id && v.folder_id !== NEW_FOLDER ? v.folder_id : null,
  priority: toPriority(v.priority),
  status: v.status as TaskStatus,
  due_date: v.due_date,
  due_time: v.due_time || null,
  estimate_min: v.estimate_min,
  link: v.link.trim(),
  notes: v.notes,
  checklist,
})

/**
 * Modale task. Ctrl/⌘+Invio salva, Esc chiude.
 * La scadenza è obbligatoria (default oggi); le collegate si salvano insieme alla task.
 */
export function TaskModal({ taskId, preset }: { taskId?: string; preset?: TaskPreset }) {
  const view = useData()
  const scope = useUi((s) => s.scope)
  const actions = useTaskActions()
  const { saveFolder } = useCompanyActions()
  const original = taskId ? view.taskById.get(taskId) : undefined
  const isNew = !original
  const [id] = useState(() => original?.id ?? newId())

  // senza aziende non si può creare una task: prima l'azienda
  const noCompanies = !view.companies.length
  useEffect(() => {
    if (noCompanies) {
      toast("Crea prima un'azienda")
      openModal({ kind: 'company' })
    }
  }, [noCompanies])

  const [defaults] = useState<FormValues>(() => {
    if (original) {
      return {
        title: original.title,
        company_id: original.company_id,
        folder_id: original.folder_id ?? '',
        priority: original.priority,
        status: original.status,
        due_date: original.due_date,
        due_time: original.due_time ?? '',
        estimate_min: original.estimate_min,
        link: original.link,
        notes: original.notes,
      }
    }
    const companyId =
      preset?.company_id ??
      (scope.companyId && view.companyById.has(scope.companyId) ? scope.companyId : view.companies[0]?.id) ??
      ''
    const folderId =
      preset?.folder_id !== undefined
        ? (preset.folder_id ?? '')
        : scope.folderId && view.folderById.get(scope.folderId)?.company_id === companyId
          ? scope.folderId
          : ''
    return {
      title: '',
      company_id: companyId,
      folder_id: folderId,
      priority: preset?.priority ?? 3,
      status: preset?.status ?? 'todo',
      due_date: preset?.due_date ?? todayISO(),
      due_time: '',
      estimate_min: 0,
      link: '',
      notes: '',
    }
  })

  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => original?.checklist ?? [])
  const [linkedIds, setLinkedIds] = useState<string[]>(() =>
    original ? (view.linkIdx.children.get(original.id) ?? []) : [],
  )
  const [clNew, setClNew] = useState('')
  const [folderNew, setFolderNew] = useState('')
  const clNewRef = useRef<HTMLInputElement>(null)

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults })
  const { register, control, handleSubmit, setValue, getValues } = form
  const companyId = useWatch({ control, name: 'company_id' })
  const folderId = useWatch({ control, name: 'folder_id' })
  const dueDate = useWatch({ control, name: 'due_date' })
  const priority = useWatch({ control, name: 'priority' })
  const link = useWatch({ control, name: 'link' })
  const folders = view.foldersOf(companyId)

  const save = (v: FormValues) => {
    actions.saveTask({ id, isNew, fields: toFields(v, checklist), linkedIds })
    closeModal()
  }
  const onInvalid = (errors: FieldErrors<FormValues>) => {
    const first = Object.values(errors)[0]
    toast(first?.message ?? 'Controlla i campi')
  }
  const submit = handleSubmit(save, onInvalid)

  /** Apre una collegata: salva prima la task corrente (se è valida), poi apre l'altra. */
  const openLinked = (childId: string) => {
    const v = getValues()
    const parsed = schema.safeParse(v)
    if (parsed.success)
      actions.saveTask({ id, isNew, fields: toFields(parsed.data, checklist), linkedIds }, { silent: true })
    openModal({ kind: 'task', taskId: childId })
  }

  const addFolder = () => {
    const name = folderNew.trim()
    if (!name || !companyId) return
    const fid = saveFolder({ name, companyId }, { silent: true })
    setValue('folder_id', fid)
    setFolderNew('')
  }

  if (noCompanies) return null

  return (
    <Modal
      title={isNew ? 'Nuova task' : 'Modifica task'}
      onClose={closeModal}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          void submit()
        }
      }}
    >
      <form onSubmit={submit} autoComplete="off" noValidate>
        <ModalBody>
          <input
            {...register('title')}
            autoFocus
            aria-label="Titolo"
            placeholder="Cosa c'è da fare?"
            className="w-full border-0 border-b border-line bg-transparent px-0 py-1 text-[17px] font-semibold outline-none placeholder:text-ink-3 focus:border-accent"
          />

          <div className="grid grid-cols-2 gap-3 mobile:grid-cols-1">
            <div className="field">
              <label htmlFor="t-company">Azienda</label>
              <select
                id="t-company"
                className="input"
                {...register('company_id', { onChange: () => setValue('folder_id', '') })}
              >
                {view.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="t-folder">Cartella di lavoro</label>
              <select id="t-folder" className="input" {...register('folder_id')}>
                <option value="">— Nessuna cartella —</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
                <option value={NEW_FOLDER}>+ Nuova cartella…</option>
              </select>
              {folderId === NEW_FOLDER && (
                <input
                  autoFocus
                  className="input"
                  aria-label="Nome nuova cartella"
                  placeholder="Nome nuova cartella e Invio"
                  value={folderNew}
                  onChange={(e) => setFolderNew(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addFolder()
                    }
                  }}
                />
              )}
            </div>
          </div>

          <div className="field">
            <span className="field-label" id="t-prio">
              Priorità (1 = più urgente)
            </span>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Segmented<Priority>
                  label="Priorità"
                  value={toPriority(field.value)}
                  onChange={field.onChange}
                  options={PRIOS.map((p) => ({
                    value: p.id,
                    label: p.label,
                    sub: p.name,
                    color: p.color,
                    title: p.name,
                  }))}
                />
              )}
            />
          </div>
          <div className="field">
            <span className="field-label">Stato</span>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Segmented<TaskStatus>
                  label="Stato"
                  value={field.value as TaskStatus}
                  onChange={field.onChange}
                  options={STATI.map((s) => ({ value: s.id, label: s.label, color: s.color }))}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 mobile:grid-cols-2">
            <div className="field">
              <label htmlFor="t-due">Scadenza *</label>
              <input id="t-due" type="date" required className="input num" {...register('due_date')} />
            </div>
            <div className="field">
              <label htmlFor="t-time">Ora (facoltativa)</label>
              <input id="t-time" type="time" className="input num" {...register('due_time')} />
            </div>
            <div className="field">
              <label htmlFor="t-est">Stima (minuti)</label>
              <input
                id="t-est"
                type="number"
                min={0}
                step={5}
                inputMode="numeric"
                placeholder="es. 60"
                className="input num"
                {...register('estimate_min', {
                  setValueAs: (v: unknown) => Math.max(0, Math.round(Number(v) || 0)),
                })}
              />
            </div>
          </div>

          <LinkedTasks
            taskId={id}
            isNew={isNew}
            linkedIds={linkedIds}
            onChange={setLinkedIds}
            dueDate={dueDate}
            companyId={companyId}
            folderId={folderId && folderId !== NEW_FOLDER ? folderId : null}
            priority={toPriority(priority)}
            onOpen={openLinked}
          />

          <div className="field">
            <span className="field-label">Checklist</span>
            <div className="flex flex-col gap-1">
              {checklist.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={c.done}
                    label={c.done ? 'Segna da fare' : 'Segna fatto'}
                    onChange={() =>
                      setChecklist((l) => l.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))
                    }
                  />
                  <input
                    type="text"
                    aria-label="Passaggio"
                    value={c.text}
                    onChange={(e) =>
                      setChecklist((l) => l.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        clNewRef.current?.focus()
                      }
                    }}
                    className={cn(
                      'flex-1 border-0 border-b border-transparent bg-transparent px-0.5 py-1 outline-none focus:border-accent',
                      c.done && 'text-ink-3 line-through',
                    )}
                  />
                  <button
                    type="button"
                    aria-label="Rimuovi passaggio"
                    onClick={() => setChecklist((l) => l.filter((x) => x.id !== c.id))}
                    className="hit-slop grid size-[22px] place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-danger [&_svg]:size-3.5"
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>
            <input
              ref={clNewRef}
              className="input mt-1"
              aria-label="Nuovo passaggio"
              placeholder="Aggiungi un passaggio e premi Invio"
              value={clNew}
              onChange={(e) => setClNew(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const text = clNew.trim()
                  if (!text) return
                  setChecklist((l) => [...l, { id: newId(), text, done: false }])
                  setClNew('')
                }
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="t-link">Link (Drive, Canva, Figma…)</label>
            <input id="t-link" type="url" placeholder="https://" className="input" {...register('link')} />
            {link?.trim() && (
              <a
                href={normUrl(link)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 self-start text-xs text-accent hover:underline"
              >
                <ExternalLink className="size-3" aria-hidden /> Apri link
              </a>
            )}
          </div>

          <div className="field">
            <label htmlFor="t-notes">Note</label>
            <textarea
              id="t-notes"
              placeholder="Brief, formati, riferimenti…"
              className="input"
              {...register('notes')}
            />
          </div>
        </ModalBody>

        <ModalFooter>
          {!isNew && (
            <>
              <ConfirmButton
                onConfirm={() => {
                  actions.deleteTask(id)
                  closeModal()
                }}
              >
                Elimina
              </ConfirmButton>
              <Button
                variant="ghost"
                onClick={() => {
                  const copyId = actions.duplicateTask(toFields(getValues(), checklist))
                  openModal({ kind: 'task', taskId: copyId })
                }}
              >
                Duplica
              </Button>
            </>
          )}
          <span className="flex-1" />
          <span className="text-[11.5px] text-ink-3 mobile:hidden">
            <Kbd>Ctrl</Kbd>+<Kbd>Invio</Kbd>
          </span>
          <Button onClick={closeModal}>Annulla</Button>
          <Button type="submit" variant="primary">
            {isNew ? 'Crea task' : 'Salva'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
