import type { Enums, Tables } from './database.types'
import type { CompanyBrand } from './brand'
import type { CompanyProfile } from './profile'

export type TaskStatus = Enums<'task_status'>
export type Priority = 1 | 2 | 3 | 4 | 5

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

/** Righe del DB con i campi jsonb già tipizzati. */
export type Task = Omit<Tables<'tasks'>, 'checklist' | 'priority'> & {
  checklist: ChecklistItem[]
  priority: Priority
}
export type Company = Omit<Tables<'companies'>, 'profile' | 'brand'> & {
  profile: CompanyProfile
  /** Setup aziendale: logo, colori, font, tono di voce, documenti */
  brand: CompanyBrand
}
export type Folder = Tables<'folders'>
export type TaskLink = Tables<'task_links'>

export type CalendarColorBy = 'company' | 'priority'
export type HorizonDays = 7 | 14 | 30 | 60
export const HORIZONS: HorizonDays[] = [7, 14, 30, 60]

export type UserSettings = Omit<Tables<'user_settings'>, 'calendar_color_by' | 'horizon_days'> & {
  calendar_color_by: CalendarColorBy
  horizon_days: HorizonDays
}

/** Tutti i dati dell'utente: è il contenuto della cache TanStack Query. */
export interface Snapshot {
  companies: Company[]
  folders: Folder[]
  tasks: Task[]
  links: TaskLink[]
}

export const emptySnapshot = (): Snapshot => ({ companies: [], folders: [], tasks: [], links: [] })

export type DueFilter = 'over' | 'today' | 'week' | 'doing'
export const DUE_FILTERS: DueFilter[] = ['over', 'today', 'week', 'doing']
export type ListGroup = 'priority' | 'company' | 'status'

export interface Scope {
  companyId: string | null
  folderId: string | null
}
