import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { FALLBACK_COLOR } from '@/lib/colors'
import { fmtMonthYear, monthGrid, shiftMonth, WEEKDAYS } from '@/lib/dates'
import { compareByTime } from '@/lib/filters'
import { cn } from '@/lib/format'
import { MOBILE_QUERY, useMediaQuery, useToday } from '@/lib/hooks'
import { PRIOS, prio } from '@/lib/priority'
import type { CalendarColorBy, Company, Task } from '@/lib/types'
import { useUi } from '@/stores/ui'
import { DayCell } from './DayCell'

export interface MonthGridProps {
  tasks: Task[]
  companies: Map<string, Company>
  colorBy: CalendarColorBy
  /** aziende in legenda (se colori per azienda) */
  legendCompanies: Company[]
  /** modulo (Home / pannello azienda): niente limite di eventi, click sul giorno apre la modale */
  compact?: boolean
  /**
   * Il calendario riempie l'altezza disponibile: le 6 settimane si dividono lo spazio e ogni giorno
   * mostra tanti eventi quanti ne entrano, con "+N" nella testata del giorno per gli altri.
   */
  fill?: boolean
  /** intestazione del modulo (icona, titolo, azioni) sulla stessa riga dei controlli del mese */
  heading?: { icon: ReactNode; title: string; right?: ReactNode }
  selectedDay?: string
  onDayClick: (date: string) => void
  /** controlli extra nell'intestazione (selettore colori) */
  extra?: ReactNode
  className?: string
}

/** Altezza di un evento compatto (17px) + 1px di spazio, e testata del giorno. */
const SLOT_PX = 18
const DAY_HEADER_PX = 19

/** Mese con griglia lunedì → domenica su 6 settimane. */
export function MonthGrid({
  tasks,
  companies,
  colorBy,
  legendCompanies,
  compact = false,
  fill = false,
  heading,
  selectedDay,
  onDayClick,
  extra,
  className,
}: MonthGridProps) {
  const today = useToday()
  const month = useUi((s) => s.calMonth)
  const setMonth = useUi((s) => s.setCalMonth)
  const goToday = useUi((s) => s.goToday)
  const days = useMemo(() => monthGrid(month), [month])
  const gridRef = useRef<HTMLDivElement>(null)
  const [rowH, setRowH] = useState(0)
  // su telefono i titoli non entrano nelle celle: pallini colorati, il dettaglio si apre col tocco
  const dots = useMediaQuery(MOBILE_QUERY) && !fill

  // in modalità fill misura l'altezza delle righe per sapere quanti eventi entrano in un giorno
  useLayoutEffect(() => {
    const el = gridRef.current
    if (!fill || !el) return
    const measure = () => setRowH(el.clientHeight / 6)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fill])

  const limit = fill ? Math.max(0, Math.floor((rowH - DAY_HEADER_PX) / SLOT_PX)) : compact ? Infinity : 3

  const byDay = useMemo(() => {
    const first = days[0]!
    const last = days[days.length - 1]!
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.due_date || t.due_date < first || t.due_date > last) continue
      const arr = map.get(t.due_date)
      if (arr) arr.push(t)
      else map.set(t.due_date, [t])
    }
    for (const arr of map.values()) arr.sort(compareByTime)
    return map
  }, [tasks, days])

  const colorOf = (t: Task) =>
    colorBy === 'priority' ? prio(t.priority).color : (companies.get(t.company_id)?.color ?? FALLBACK_COLOR)

  const nav = (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Mese precedente"
        onClick={() => setMonth(shiftMonth(month, -1))}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Mese successivo"
        onClick={() => setMonth(shiftMonth(month, 1))}
      >
        <ChevronRight />
      </Button>
    </>
  )

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden bg-surface', className)}>
      {heading ? (
        <div className="module-dash flex flex-wrap items-center gap-2.5 border-b border-line px-[18px] pt-3.5 pb-3">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent [&_svg]:size-[17px]"
          >
            {heading.icon}
          </span>
          <h3 className="m-0 text-base font-extrabold tracking-[-0.01em]">{heading.title}</h3>
          <div className="ml-2 flex items-center gap-0.5">
            {nav}
            <span className="ml-1.5 min-w-[130px] text-[15px] font-semibold capitalize" aria-live="polite">
              {fmtMonthYear(month)}
            </span>
            <Button size="sm" onClick={goToday}>
              Oggi
            </Button>
          </div>
          {heading.right && <span className="ml-auto flex items-center gap-1.5">{heading.right}</span>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-2.5">
          {nav}
          <h3 className="m-0 mr-2 min-w-[150px] text-base font-semibold capitalize" aria-live="polite">
            {fmtMonthYear(month)}
          </h3>
          <Button onClick={goToday}>Oggi</Button>
          {extra}
        </div>
      )}
      <div
        className={cn(
          'flex flex-wrap gap-x-3.5 gap-y-1.5 border-b border-line px-3.5 text-xs text-ink-2',
          fill ? 'py-1.5' : 'py-2',
        )}
      >
        {colorBy === 'company'
          ? legendCompanies.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-[5px]">
                <span className="size-2.5 rounded-[3px]" style={{ background: c.color }} aria-hidden />
                {c.name}
              </span>
            ))
          : PRIOS.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-[5px]">
                <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} aria-hidden />
                {p.label} · {p.name}
              </span>
            ))}
      </div>
      <div className="grid grid-cols-7 border-b border-line" aria-hidden>
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className={cn(
              'px-2 text-[11px] tracking-[0.05em] text-ink-3 uppercase',
              fill ? 'py-1' : 'py-[7px]',
            )}
          >
            {d}
          </div>
        ))}
      </div>
      <div
        ref={gridRef}
        className={cn(
          'grid flex-1 grid-cols-7',
          fill
            ? 'min-h-0 grid-rows-6'
            : dots
              ? 'auto-rows-[minmax(58px,auto)]'
              : compact
                ? 'auto-rows-[minmax(92px,auto)]'
                : 'auto-rows-[minmax(104px,1fr)]',
        )}
      >
        {days.map((d, i) => (
          <DayCell
            key={d}
            date={d}
            tasks={byDay.get(d)}
            colorOf={colorOf}
            limit={limit}
            fill={fill}
            dots={dots}
            outside={d.slice(0, 7) !== month}
            isToday={d === today}
            picked={!compact && d === selectedDay}
            lastInRow={i % 7 === 6}
            onClick={onDayClick}
          />
        ))}
      </div>
    </div>
  )
}
