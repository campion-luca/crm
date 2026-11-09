import { Link, useNavigate } from '@tanstack/react-router'
import { Bell, Calendar, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Chip'
import { Module, ModuleFooter } from '@/components/ui/Module'
import { useData, useSettings } from '@/data/queries'
import { addDaysISO, fmtLongDate, greeting } from '@/lib/dates'
import { inScope, isOver } from '@/lib/filters'
import { cn } from '@/lib/format'
import { FIT_QUERY, useMediaQuery, useNow, useToday } from '@/lib/hooks'
import type { DueFilter } from '@/lib/types'
import { openModal } from '@/stores/modals'
import { useUi } from '@/stores/ui'
import { MonthGrid } from '@/features/calendar/MonthGrid'
import { CompanyStrip } from '@/features/companies/CompanyStrip'
import { DeadlineList } from '@/features/deadlines/DeadlineList'
import { CompletedTable } from '@/features/tasks/CompletedTable'

const linkBtn = 'inline-flex items-center rounded-md px-1.5 py-1 font-bold text-accent hover:bg-accent-soft'

export function HomePage() {
  const view = useData()
  const settings = useSettings()
  const scope = useUi((s) => s.scope)
  const today = useToday()
  const now = useNow()
  const navigate = useNavigate()

  const open = view.tasks.filter((t) => t.status !== 'done' && inScope(t, scope))
  const in7 = addDaysISO(today, 7)
  const overN = open.filter((t) => isOver(t, today)).length
  const todayN = open.filter((t) => t.due_date === today).length
  const weekN = open.filter((t) => t.due_date > today && t.due_date <= in7).length
  const noDate = open.filter((t) => !t.due_date).length
  const company = scope.companyId ? view.companyById.get(scope.companyId) : undefined
  const folder = scope.folderId ? view.folderById.get(scope.folderId) : undefined
  const scopeText = folder ? ` · ${folder.name}` : company ? ` · ${company.name}` : ''
  const goList = (due: DueFilter) => void navigate({ to: '/lista', search: { due } })
  // schermi abbastanza grandi: la Home sta tutta nello schermo e i moduli si dividono l'altezza
  const fit = useMediaQuery(FIT_QUERY)

  return (
    <div className={cn('flex max-w-[1500px] flex-col', fit ? 'h-full gap-4' : 'gap-5')}>
      <div className="flex shrink-0 flex-wrap items-end gap-4">
        <div>
          <h2 className="m-0 text-[28px] font-extrabold tracking-[-0.025em] mobile:text-2xl">
            {greeting(now.getHours())}!
          </h2>
          <p className="mt-1 mb-0 text-sm text-ink-2">
            {fmtLongDate(now)}
            {scopeText}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 mobile:ml-0">
          <Pill
            count={overN}
            label="in ritardo"
            bg="rgba(255,93,115,.16)"
            fg="#ff8394"
            onClick={() => goList('over')}
          />
          <Pill
            count={todayN}
            label="oggi"
            bg="rgba(255,181,71,.16)"
            fg="#ffc76e"
            onClick={() => goList('today')}
          />
          <Pill
            count={weekN}
            label="questa settimana"
            bg="rgba(255,110,180,.16)"
            fg="#ff8fc6"
            onClick={() => goList('week')}
          />
        </div>
      </div>

      <div
        className={cn(
          'grid grid-cols-[minmax(0,1.8fr)_minmax(330px,1fr)] narrow:grid-cols-1',
          fit ? 'min-h-0 flex-1 gap-4' : 'items-start gap-5',
        )}
      >
        {/* su telefono le colonne si sciolgono (contents) e "In scadenza" passa in cima */}
        <div className={cn('flex min-w-0 flex-col gap-4 mobile:contents', fit && 'min-h-0')}>
          <Module className={cn('mobile:order-2', fit && 'min-h-0 flex-1')}>
            <MonthGrid
              compact
              fill={fit}
              className={fit ? 'flex-1' : undefined}
              heading={{
                icon: <Calendar />,
                title: 'Calendario',
                right: (
                  <Link to="/calendario" className={linkBtn}>
                    Apri pianificazione
                  </Link>
                ),
              }}
              tasks={view.tasks}
              companies={view.companyById}
              colorBy="company"
              legendCompanies={view.companies}
              onDayClick={(d) => openModal({ kind: 'day', date: d, source: 'all' })}
            />
          </Module>

          <section aria-labelledby="home-aziende" className="flex shrink-0 flex-col gap-2 mobile:order-3">
            <div className="flex items-center gap-2.5">
              <h3 id="home-aziende" className="m-0 text-[17px] font-extrabold tracking-[-0.015em]">
                Aziende
              </h3>
              <span className="num text-[13px] text-ink-3">{view.companies.length}</span>
              <Link to="/aziende" className={`${linkBtn} ml-auto`}>
                Gestisci aziende
              </Link>
            </div>
            <CompanyStrip />
          </section>
        </div>

        <div className={cn('flex min-w-0 flex-col gap-4 mobile:contents', fit && 'min-h-0')}>
          <Module
            title="In scadenza"
            icon={<Bell />}
            count={`prossimi ${settings.horizon_days} giorni`}
            className={cn('mobile:order-1', fit && 'min-h-0 flex-1')}
            right={
              <Button
                variant="primary"
                size="icon"
                aria-label="Nuova task"
                onClick={() => openModal({ kind: 'task' })}
              >
                <Plus />
              </Button>
            }
          >
            <DeadlineList tasks={open} horizon={settings.horizon_days} fill={fit} />
            <ModuleFooter>
              <span>{noDate ? `${noDate} task senza scadenza` : 'Tutte le task hanno una data'}</span>
              <Link to="/lista" className={linkBtn}>
                Vedi tutto in lista
              </Link>
            </ModuleFooter>
          </Module>
          <CompletedTable
            tasks={view.tasks}
            compact
            fill={fit}
            className={cn('mobile:order-4', fit && 'max-h-[42%] min-h-0 shrink-0')}
          />
        </div>
      </div>
    </div>
  )
}
