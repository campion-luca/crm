import type { DueFilter } from '@/lib/types'
import { DUE_FILTERS } from '@/lib/types'

/** Filtri della toolbar nei search params: tipizzati e mantenuti tra Board, Lista e Calendario. */
export interface TaskSearch {
  q?: string | undefined
  prio?: number | undefined
  due?: DueFilter | undefined
}

/**
 * Validazione dei search params (senza zod: questo codice è nel bundle iniziale).
 * Valori non validi vengono scartati invece di rompere la pagina.
 */
export function parseTaskSearch(raw: Record<string, unknown>): TaskSearch {
  const out: TaskSearch = {}
  if (typeof raw.q === 'string' && raw.q) out.q = raw.q
  const p = Number(raw.prio)
  if (Number.isInteger(p) && p >= 1 && p <= 5) out.prio = p
  if ((DUE_FILTERS as unknown[]).includes(raw.due)) out.due = raw.due as DueFilter
  return out
}

export const DASH_TABS = ['panoramica', 'scheda', 'setup'] as const
export type DashTabSearch = { tab?: (typeof DASH_TABS)[number] | undefined }

export function parseDashSearch(raw: Record<string, unknown>): DashTabSearch {
  return (DASH_TABS as readonly unknown[]).includes(raw.tab) ? { tab: raw.tab as DashTabSearch['tab'] } : {}
}

export type AppPath = '/' | '/calendario' | '/scadenze' | '/aziende' | '/board' | '/lista' | '/impostazioni'

/** Viste con toolbar filtri e riepilogo. */
export const FILTER_PATHS = ['/board', '/lista', '/calendario'] as const
