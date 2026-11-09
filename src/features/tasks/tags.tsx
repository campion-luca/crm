import { Clock, Folder as FolderIcon, Link2, ListChecks } from 'lucide-react'
import { tint } from '@/lib/colors'
import { fmtDue } from '@/lib/dates'
import { cn } from '@/lib/format'
import { prio, statusDef } from '@/lib/priority'
import type { Progress } from '@/lib/stats'
import type { Company, Folder, Task } from '@/lib/types'

export function PrioPill({ p }: { p: number }) {
  const x = prio(p)
  return (
    <span
      title={`Priorità ${x.id} · ${x.name}`}
      className="rounded-full px-[7px] py-0.5 text-[11px] font-semibold tracking-[0.01em] whitespace-nowrap"
      style={{ background: tint(x.color, 16), color: x.color }}
    >
      {x.label}
    </span>
  )
}

export function StatusPill({ s }: { s: string }) {
  const x = statusDef(s)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-2">
      <span className="size-2 rounded-full" style={{ background: x.color }} aria-hidden />
      {x.label}
    </span>
  )
}

/** Pallino azienda + "Azienda · Cartella" (o solo la cartella dentro il pannello azienda). */
export function CoTag({
  company,
  folder,
  showCompany = true,
  className,
}: {
  company: Company | undefined
  folder: Folder | undefined
  showCompany?: boolean
  className?: string
}) {
  if (!company) return null
  const text = showCompany
    ? folder
      ? `${company.name} · ${folder.name}`
      : company.name
    : (folder?.name ?? '')
  return (
    <span className={cn('inline-flex max-w-full min-w-0 items-center gap-[5px]', className)}>
      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: company.color }} aria-hidden />
      <span className="truncate">{text}</span>
    </span>
  )
}

export function FolderTag({ folder }: { folder: Folder | undefined }) {
  if (!folder) return null
  return (
    <span className="inline-flex min-w-0 items-center gap-[5px]">
      <FolderIcon className="size-[13px] shrink-0" aria-hidden />
      <span className="truncate">{folder.name}</span>
    </span>
  )
}

export function DueTag({
  task,
  today,
}: {
  task: Pick<Task, 'due_date' | 'due_time' | 'status'>
  today: string
}) {
  if (!task.due_date) return null
  const open = task.status !== 'done'
  const over = open && task.due_date < today
  const isToday = open && task.due_date === today
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 num text-[11.5px] whitespace-nowrap',
        over ? 'font-medium text-danger' : isToday ? 'font-medium text-warn' : 'text-ink-2',
      )}
    >
      <Clock className="size-3" aria-hidden />
      {fmtDue(task.due_date, task.due_time, today)}
      {over && <span className="sr-only"> (in ritardo)</span>}
    </span>
  )
}

/** Icona link con collegate fatte/totali: rosa, verde quando sono tutte fatte. */
export function LinkTag({ done, total }: { done: number; total: number }) {
  if (!total) return null
  const all = done === total
  return (
    <span
      title="Task collegate completate"
      className={cn('inline-flex items-center gap-1 num text-[11.5px]', all ? 'text-ok' : 'text-accent')}
    >
      <Link2 className="size-3" aria-hidden />
      {done}/{total}
      <span className="sr-only"> collegate completate</span>
    </span>
  )
}

export function ChecklistTag({ progress }: { progress: Progress | null }) {
  if (!progress) return null
  return (
    <span className="inline-flex items-center gap-1 num text-[11.5px] text-ink-3" title="Checklist">
      <ListChecks className="size-3" aria-hidden />
      {progress.done}/{progress.total}
    </span>
  )
}

/** Chip rosa "per: <titolo principale>" (+N se le principali sono più di una). */
export function ForTag({ title, more }: { title: string; more: number }) {
  if (!title) return null
  return (
    <span
      title="Serve per completare"
      className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] whitespace-nowrap text-accent"
    >
      <Link2 className="size-3 shrink-0" aria-hidden />
      <span className="truncate">per: {title}</span>
      {more > 0 && <span className="shrink-0">+{more}</span>}
    </span>
  )
}
