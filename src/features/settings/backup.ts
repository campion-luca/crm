import { indexLinks, wouldCreateCycle } from '@/lib/cycles'
import { nextCompanyColor } from '@/lib/colors'
import { fmtTime } from '@/lib/dates'
import { newId } from '@/lib/format'
import { isTaskStatus, toPriority } from '@/lib/priority'
import { parseBrand, withoutFiles } from '@/lib/brand'
import { isHex, parseProfile } from '@/lib/profile'
import type { Company, Folder, Snapshot, Task, TaskLink, UserSettings } from '@/lib/types'
import { parseChecklist } from '@/data/normalize'

export const BACKUP_APP = 'gestionale-lavoro'
export const BACKUP_VERSION = 2

/** Esporta tutto in JSON (senza user_id: il backup si può ripristinare anche su un altro account). */
export function exportBackup(snap: Snapshot, settings: UserSettings | null, now: Date = new Date()): string {
  const omitUser = <T extends { user_id: string }>({ user_id: _u, ...rest }: T) => rest
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exported_at: now.toISOString(),
      companies: snap.companies.map(omitUser),
      folders: snap.folders.map(omitUser),
      tasks: snap.tasks.map(omitUser),
      task_links: snap.links.map(omitUser),
      settings: settings ? omitUser(settings) : null,
    },
    null,
    1,
  )
}

export class BackupError extends Error {}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : [])
const text = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const LEGACY_PRIO: Record<string, number> = { urgente: 1, alta: 2, media: 3, bassa: 4 }
const isoDate = (v: unknown) => (/^\d{4}-\d{2}-\d{2}/.test(text(v)) ? text(v).slice(0, 10) : '')
const toIso = (v: unknown, fallback: Date): string => {
  if (v == null || v === '') return fallback.toISOString()
  const d = new Date(typeof v === 'number' || typeof v === 'string' ? v : NaN)
  return Number.isNaN(d.getTime()) ? fallback.toISOString() : d.toISOString()
}

/**
 * Legge un backup: il formato di questa app (v2, snake_case) oppure quello del prototipo HTML
 * (companyId, due, linked…). Tutti gli id vengono rigenerati, così il ripristino non entra mai in
 * conflitto con righe esistenti. Le righe incomplete vengono scartate invece di far fallire tutto.
 */
export function parseBackup(
  raw: string,
  opts: { today: string; now?: Date; makeId?: () => string },
): Snapshot {
  const now = opts.now ?? new Date()
  const makeId = opts.makeId ?? newId
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new BackupError('Il testo non è un backup valido')
  }
  if (!isObj(data) || !Array.isArray(data.companies) || !Array.isArray(data.tasks)) {
    throw new BackupError('Il testo non è un backup valido')
  }

  const ids = new Map<string, string>()
  const remap = (old: unknown) => {
    const k = text(old)
    if (!k) return ''
    let v = ids.get(k)
    if (!v) {
      v = makeId()
      ids.set(k, v)
    }
    return v
  }

  const companies: Company[] = []
  const usedColors: string[] = []
  arr(data.companies).forEach((c, i) => {
    const name = text(c.name).trim().slice(0, 120)
    if (!name || !text(c.id)) return
    const color = isHex(text(c.color)) ? text(c.color).toLowerCase() : nextCompanyColor(usedColors)
    usedColors.push(color)
    const profile = parseProfile(c.profile)
    companies.push({
      id: remap(c.id),
      user_id: '',
      name,
      color,
      position: i,
      profile,
      // i file (loghi, font, documenti) non viaggiano nel backup: restano testi, colori e link
      brand: withoutFiles(parseBrand(c.brand, profile)),
      created_at: toIso(c.created_at, new Date(now.getTime() + i)),
    })
  })
  const companyIds = new Set(companies.map((c) => c.id))

  const folders: Folder[] = []
  arr(data.folders).forEach((f, i) => {
    const companyId = ids.get(text(f.company_id ?? f.companyId)) ?? ''
    const name = text(f.name).trim().slice(0, 120)
    if (!companyIds.has(companyId) || !name || !text(f.id)) return
    folders.push({
      id: remap(f.id),
      user_id: '',
      company_id: companyId,
      name,
      // le posizioni sono per azienda e partono da 0: 0 è un valore valido, non "mancante"
      position:
        f.position != null && f.position !== '' && Number.isFinite(Number(f.position))
          ? Number(f.position)
          : i,
      created_at: toIso(f.created_at, new Date(now.getTime() + i)),
    })
  })
  const folderCompany = new Map(folders.map((f) => [f.id, f.company_id]))

  const tasks: Task[] = []
  arr(data.tasks).forEach((t, i) => {
    const companyId = ids.get(text(t.company_id ?? t.companyId)) ?? ''
    const title = text(t.title).trim().slice(0, 300)
    if (!companyIds.has(companyId) || !title || !text(t.id)) return
    const folderId = ids.get(text(t.folder_id ?? t.folderId)) ?? null
    const status = isTaskStatus(t.status) ? t.status : 'todo'
    const rawPrio = text(t.priority)
    const time = text(t.due_time ?? t.time)
    tasks.push({
      id: remap(t.id),
      user_id: '',
      company_id: companyId,
      folder_id: folderId && folderCompany.get(folderId) === companyId ? folderId : null,
      title,
      notes: text(t.notes),
      link: text(t.link),
      priority: toPriority(LEGACY_PRIO[rawPrio] ?? rawPrio),
      status,
      due_date: isoDate(t.due_date ?? t.due) || opts.today,
      due_time: /^\d{2}:\d{2}/.test(time) ? fmtTime(time) : null,
      estimate_min: Math.max(0, Math.round(Number(t.estimate_min ?? t.estimate) || 0)),
      checklist: parseChecklist(t.checklist).map((c) => ({ ...c, id: makeId() })),
      completed_at: status === 'done' ? toIso(t.completed_at ?? t.completedAt, now) : null,
      created_at: toIso(t.created_at ?? t.created, new Date(now.getTime() + i)),
      updated_at: now.toISOString(),
    })
  })
  const taskIds = new Set(tasks.map((t) => t.id))

  // collegamenti: v2 → task_links, prototipo → tasks[].linked
  const pairs: [unknown, unknown][] = Array.isArray(data.task_links)
    ? arr(data.task_links).map((l) => [l.parent_id, l.child_id])
    : arr(data.tasks).flatMap((t) =>
        Array.isArray(t.linked) ? t.linked.map((c): [unknown, unknown] => [t.id, c]) : [],
      )
  const links: TaskLink[] = []
  for (const [p, c] of pairs) {
    const parent = ids.get(text(p)) ?? ''
    const child = ids.get(text(c)) ?? ''
    if (!taskIds.has(parent) || !taskIds.has(child)) continue
    if (links.some((l) => l.parent_id === parent && l.child_id === child)) continue
    if (wouldCreateCycle(parent, child, indexLinks(links))) continue
    links.push({ parent_id: parent, child_id: child, user_id: '' })
  }

  return { companies, folders, tasks, links }
}
