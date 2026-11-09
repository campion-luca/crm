import type { Tables } from '@/lib/database.types'
import { fmtTime } from '@/lib/dates'
import { isTaskStatus, toPriority } from '@/lib/priority'
import { parseBrand } from '@/lib/brand'
import { parseProfile } from '@/lib/profile'
import type { ChecklistItem, Company, Folder, Task, TaskLink, UserSettings } from '@/lib/types'
import { HORIZONS } from '@/lib/types'

/**
 * Le righe arrivano da PostgREST, da Realtime o da localStorage: qui diventano tipi di dominio
 * con formati uniformi (timestamp ISO "Z", ora "HH:MM", jsonb validati).
 */
const iso = (v: unknown): string => {
  const d = new Date(typeof v === 'string' || typeof v === 'number' ? v : Date.now())
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}
const isoOrNull = (v: unknown): string | null => (v == null || v === '' ? null : iso(v))
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

export function parseChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({ id: str(x.id) || crypto.randomUUID(), text: str(x.text), done: x.done === true }))
}

type Loose<T> = { [K in keyof T]?: unknown }

export function toTask(row: Loose<Tables<'tasks'>>): Task {
  return {
    id: str(row.id),
    user_id: str(row.user_id),
    company_id: str(row.company_id),
    folder_id: row.folder_id ? str(row.folder_id) : null,
    title: str(row.title),
    notes: str(row.notes),
    link: str(row.link),
    priority: toPriority(row.priority),
    status: isTaskStatus(row.status) ? row.status : 'todo',
    due_date: str(row.due_date).slice(0, 10),
    due_time: row.due_time ? fmtTime(str(row.due_time)) : null,
    estimate_min: Math.max(0, Math.round(Number(row.estimate_min) || 0)),
    checklist: parseChecklist(row.checklist),
    completed_at: isoOrNull(row.completed_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at ?? row.created_at),
  }
}

export function toCompany(row: Loose<Tables<'companies'>>): Company {
  const profile = parseProfile(row.profile)
  return {
    id: str(row.id),
    user_id: str(row.user_id),
    name: str(row.name),
    color: str(row.color) || '#888888',
    position: Number(row.position) || 0,
    profile,
    brand: parseBrand(row.brand, profile),
    created_at: iso(row.created_at),
  }
}

export function toFolder(row: Loose<Tables<'folders'>>): Folder {
  return {
    id: str(row.id),
    user_id: str(row.user_id),
    company_id: str(row.company_id),
    name: str(row.name),
    position: Number(row.position) || 0,
    created_at: iso(row.created_at),
  }
}

export function toLink(row: Loose<Tables<'task_links'>>): TaskLink {
  return { parent_id: str(row.parent_id), child_id: str(row.child_id), user_id: str(row.user_id) }
}

export const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id'> = {
  calendar_color_by: 'company',
  horizon_days: 14,
  show_done: true,
  available_hours: 8,
}

export function toSettings(row: Loose<Tables<'user_settings'>>): UserSettings {
  const h = Number(row.horizon_days)
  return {
    user_id: str(row.user_id),
    calendar_color_by: row.calendar_color_by === 'priority' ? 'priority' : 'company',
    horizon_days: (HORIZONS as number[]).includes(h) ? (h as UserSettings['horizon_days']) : 14,
    show_done: row.show_done !== false,
    available_hours: Number.isFinite(Number(row.available_hours)) ? Number(row.available_hours) : 8,
  }
}

export const byPosition = <T extends { position: number; created_at: string }>(a: T, b: T) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at)
