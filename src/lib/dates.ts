import { addDays, addMonths, differenceInCalendarDays, format, getDay, parseISO, startOfWeek } from 'date-fns'
import { it } from 'date-fns/locale'

/** Le date di scadenza sono stringhe 'yyyy-MM-dd' in ora locale; la settimana inizia di lunedì. */
const opts = { locale: it, weekStartsOn: 1 as const }

export const toISODate = (d: Date): string => format(d, 'yyyy-MM-dd')
export const todayISO = (now: Date = new Date()): string => toISODate(now)
/** 'yyyy-MM-dd' → mezzanotte locale. */
export const parseDate = (s: string): Date => parseISO(s)
export const addDaysISO = (s: string, n: number): string => toISODate(addDays(parseDate(s), n))
export const diffDaysISO = (a: string, b: string): number =>
  differenceInCalendarDays(parseDate(a), parseDate(b))
export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** '15:30:00' (Postgres time) o '15:30' → '15:30'. */
export const fmtTime = (t: string | null | undefined): string => (t ? t.slice(0, 5) : '')

/** Scadenza relativa: "Oggi", "Domani 12:00", "Ieri", "gio", "12 nov". */
export function fmtDue(due: string, time: string | null | undefined, today: string): string {
  const d = diffDaysISO(due, today)
  let s: string
  if (d === 0) s = 'Oggi'
  else if (d === 1) s = 'Domani'
  else if (d === -1) s = 'Ieri'
  else if (d > 1 && d < 7) s = format(parseDate(due), 'EEE', opts)
  else s = format(parseDate(due), 'd MMM', opts)
  return time ? `${s} ${fmtTime(time)}` : s
}

/** "12 nov" */
export const fmtShortDate = (iso: string): string => format(parseDate(iso), 'd MMM', opts)
/** "12 novembre" */
export const fmtDayMonth = (iso: string): string => format(parseDate(iso), 'd MMMM', opts)
/** "Venerdì 6 novembre" */
export const fmtLongDate = (d: Date): string => capitalize(format(d, 'EEEE d MMMM', opts))
/** "Ven 6 novembre" (pannello del giorno nel calendario) */
export const fmtPanelDate = (iso: string): string => capitalize(format(parseDate(iso), 'EEE d MMMM', opts))
/** "novembre 2026" */
export const fmtMonthYear = (ym: string): string => format(parseDate(`${ym}-01`), 'MMMM yyyy', opts)

/** Data e ora di completamento: "Oggi, 15:25", "Ieri, 20:25", "3 nov, 20:25" (+ anno se diverso). */
export function fmtDone(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = differenceInCalendarDays(d, now)
  let day: string
  if (diff === 0) day = 'Oggi'
  else if (diff === -1) day = 'Ieri'
  else day = format(d, d.getFullYear() !== now.getFullYear() ? 'd MMM yyyy' : 'd MMM', opts)
  return `${day}, ${format(d, 'HH:mm')}`
}

export function greeting(hour: number): string {
  if (hour < 13) return 'Buongiorno'
  if (hour < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

export const monthOf = (iso: string): string => iso.slice(0, 7)
export const shiftMonth = (ym: string, delta: number): string =>
  format(addMonths(parseDate(`${ym}-01`), delta), 'yyyy-MM')

/** 42 giorni (6 settimane, lunedì → domenica) che coprono il mese 'yyyy-MM'. */
export function monthGrid(ym: string): string[] {
  const start = startOfWeek(parseDate(`${ym}-01`), opts)
  return Array.from({ length: 42 }, (_, i) => toISODate(addDays(start, i)))
}

export const isWeekend = (iso: string): boolean => {
  const g = getDay(parseDate(iso))
  return g === 0 || g === 6
}

export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] as const

/**
 * Esito di una task completata: giorni di ritardo tra la data di completamento (locale)
 * e la scadenza. 0 o negativo = in tempo. null se non è completata.
 */
export function lateDays(task: { due_date: string; completed_at: string | null }): number | null {
  if (!task.completed_at) return null
  return diffDaysISO(toISODate(new Date(task.completed_at)), task.due_date)
}
