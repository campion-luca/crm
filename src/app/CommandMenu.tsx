import { useNavigate } from '@tanstack/react-router'
import { Command } from 'cmdk'
import {
  Bell,
  Building2,
  Calendar,
  CircleCheck,
  House,
  List,
  Plus,
  Settings,
  SquareKanban,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useData } from '@/data/queries'
import { fmtDue } from '@/lib/dates'
import { compareTasks } from '@/lib/filters'
import { useGoCompany, useToday } from '@/lib/hooks'
import { openModal } from '@/stores/modals'
import { useCommandMenu } from './commandStore'
import type { AppPath } from './search'

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const item =
  'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-ink-2 data-[selected=true]:bg-accent-soft data-[selected=true]:text-ink [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-3'

/** 3 · Command menu (⌘K / Ctrl+K): azioni, viste, aziende e ricerca tra le task. */
export function CommandDialog() {
  const setOpen = useCommandMenu((s) => s.setOpen)
  const onClose = () => setOpen(false)
  const view = useData()
  const today = useToday()
  const navigate = useNavigate()
  const goCompany = useGoCompany()
  const [q, setQ] = useState('')
  const nq = norm(q.trim())

  const run = (fn: () => void) => () => {
    onClose()
    fn()
  }
  const go = (to: AppPath) => run(() => void navigate({ to }))

  const actions: { id: string; label: string; icon: ReactNode; kbd?: string; run: () => void }[] = [
    {
      id: 'new-task',
      label: 'Nuova task',
      icon: <Plus />,
      kbd: 'N',
      run: run(() => openModal({ kind: 'task' })),
    },
    {
      id: 'new-company',
      label: 'Nuova azienda',
      icon: <Building2 />,
      run: run(() => openModal({ kind: 'company' })),
    },
    { id: 'go-home', label: 'Vai a Home', icon: <House />, kbd: 'H', run: go('/') },
    { id: 'go-cal', label: 'Vai a Calendario', icon: <Calendar />, kbd: 'C', run: go('/calendario') },
    { id: 'go-scad', label: 'Vai a In scadenza', icon: <Bell />, kbd: 'S', run: go('/scadenze') },
    { id: 'go-co', label: 'Vai ad Aziende', icon: <Building2 />, kbd: 'A', run: go('/aziende') },
    { id: 'go-board', label: 'Vai a Board', icon: <SquareKanban />, kbd: 'B', run: go('/board') },
    { id: 'go-list', label: 'Vai a Lista task', icon: <List />, kbd: 'L', run: go('/lista') },
    { id: 'go-set', label: 'Vai a Impostazioni', icon: <Settings />, run: go('/impostazioni') },
  ].filter((a) => !nq || norm(a.label).includes(nq))

  const companies = view.companies.filter((c) => !nq || norm(c.name).includes(nq))
  const tasks = nq
    ? view.tasks
        .filter((t) => norm(`${t.title} ${t.notes}`).includes(nq))
        .sort(compareTasks)
        .slice(0, 30)
    : []

  return (
    <Command.Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      label="Comandi"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-50 bg-black/70"
      contentClassName="fixed top-[12vh] left-1/2 z-50 w-[min(600px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[18px] border border-t-[3px] border-line border-t-accent bg-surface shadow-[0_20px_60px_rgba(0,0,0,.4)]"
    >
      <Command.Input
        value={q}
        onValueChange={setQ}
        placeholder="Cerca task, aziende o azioni…"
        className="w-full border-0 border-b border-line bg-transparent px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-ink-3"
      />
      <Command.List className="max-h-[min(60vh,460px)] overflow-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-ink-3">Nessun risultato</Command.Empty>
        {actions.length > 0 && (
          <Command.Group
            heading="Azioni"
            className="text-xs text-ink-3 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5"
          >
            {actions.map((a) => (
              <Command.Item key={a.id} value={a.id} onSelect={a.run} className={item}>
                {a.icon}
                <span className="text-sm">{a.label}</span>
                {a.kbd && <kbd className="kbd ml-auto">{a.kbd}</kbd>}
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {companies.length > 0 && (
          <Command.Group
            heading="Aziende"
            className="text-xs text-ink-3 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5"
          >
            {companies.map((c) => (
              <Command.Item
                key={c.id}
                value={`co-${c.id}`}
                onSelect={run(() => goCompany(c.id))}
                className={item}
              >
                <span className="size-3 shrink-0 rounded-[3px]" style={{ background: c.color }} aria-hidden />
                <span className="text-sm">{c.name}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {tasks.length > 0 && (
          <Command.Group
            heading="Task"
            className="text-xs text-ink-3 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5"
          >
            {tasks.map((t) => (
              <Command.Item
                key={t.id}
                value={`t-${t.id}`}
                onSelect={run(() => openModal({ kind: 'task', taskId: t.id }))}
                className={item}
              >
                {t.status === 'done' ? (
                  <CircleCheck className="!text-ok" />
                ) : (
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ background: view.companyById.get(t.company_id)?.color }}
                    aria-hidden
                  />
                )}
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${t.status === 'done' ? 'line-through' : ''}`}
                >
                  {t.title}
                </span>
                <span className="shrink-0 num text-[11.5px] text-ink-3">
                  {fmtDue(t.due_date, t.due_time, today)}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
      <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11.5px] text-ink-3">
        <span>
          <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> scegli
        </span>
        <span>
          <kbd className="kbd">Invio</kbd> apri
        </span>
        <span>
          <kbd className="kbd">Esc</kbd> chiudi
        </span>
      </div>
    </Command.Dialog>
  )
}
