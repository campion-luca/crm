import { Calendar, Folder as FolderIcon, Link2, List, Plus } from 'lucide-react'
import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip, ChipLink } from '@/components/ui/Chip'
import { Module } from '@/components/ui/Module'
import { Skeleton } from '@/components/ui/Skeleton'
import { useData } from '@/data/queries'
import { isOver, sumEstimate } from '@/lib/filters'
import { cn, fmtEst } from '@/lib/format'
import { useToday } from '@/lib/hooks'
import { quickLinks } from '@/lib/profile'
import type { Company } from '@/lib/types'
import { openModal } from '@/stores/modals'
import { useUi } from '@/stores/ui'
import { MonthGrid } from '@/features/calendar/MonthGrid'
import { DeadlineList } from '@/features/deadlines/DeadlineList'
import { CompletedTable } from '@/features/tasks/CompletedTable'
import { Avatar } from './CompanyCard'
import { CompanyProfileView } from './CompanyProfile'

export type DashTab = 'panoramica' | 'scheda' | 'setup'

// il Setup aziendale (upload, anteprime dei font) si scarica solo quando si apre il tab
const loadSetup = () => import('@/features/brand/BrandSetup')
const BrandSetup = lazy(() => loadSetup().then((m) => ({ default: m.BrandSetup })))

const TABS: [DashTab, string][] = [
  ['panoramica', 'Panoramica'],
  ['scheda', 'Scheda azienda'],
  ['setup', 'Setup aziendale'],
]

/** Pannello azienda: intestazione con cartelle e link rapidi, tab Panoramica | Scheda | Setup. */
export function CompanyDashboard({
  company,
  tab,
  onTab,
}: {
  company: Company
  tab: DashTab
  onTab: (t: DashTab) => void
}) {
  const view = useData()
  const today = useToday()
  const scope = useUi((s) => s.scope)
  const setScope = useUi((s) => s.setScope)
  const folders = view.foldersOf(company.id)
  const folderId = scope.folderId && folders.some((f) => f.id === scope.folderId) ? scope.folderId : null
  const all = view.tasksOf(company.id)
  const tasks = folderId ? all.filter((t) => t.folder_id === folderId) : all
  const open = tasks.filter((t) => t.status !== 'done')
  const done = tasks.length - open.length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const overN = open.filter((t) => isOver(t, today)).length
  const links = quickLinks(company.profile)
  const newTask = () => openModal({ kind: 'task', preset: { company_id: company.id, folder_id: folderId } })
  const pickFolder = (id: string | null) => setScope({ companyId: company.id, folderId: id })

  return (
    <div className="flex max-w-[1500px] flex-col gap-5" style={{ '--c': company.color } as CSSProperties}>
      <section className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-module border border-line bg-surface px-5 py-[18px] before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:bg-(--c) mobile:gap-3 mobile:px-4 mobile:py-4">
        <Avatar name={company.name} logo={company.brand.avatar} size="xl" />
        {/* telefono: avatar e nome sulla prima riga, cartelle e pulsanti a tutta larghezza sotto */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 mobile:contents">
          <h2 className="m-0 text-[26px] font-extrabold tracking-[-0.025em] mobile:min-w-0 mobile:flex-1 mobile:text-[22px]">
            {company.name}
          </h2>
          <div
            className="flex flex-wrap gap-1.5 mobile:basis-full"
            role="group"
            aria-label="Filtra per cartella"
          >
            <Chip tone="company" on={!folderId} onClick={() => pickFolder(null)}>
              Tutte le cartelle
            </Chip>
            {folders.map((f) => (
              <Chip key={f.id} tone="company" on={folderId === f.id} onClick={() => pickFolder(f.id)}>
                <FolderIcon aria-hidden />
                {f.name}
              </Chip>
            ))}
            <Chip onClick={() => openModal({ kind: 'folder', companyId: company.id })}>
              <Plus aria-hidden /> Cartella
            </Chip>
          </div>
        </div>
        <div className="flex gap-2 mobile:basis-full">
          <Button
            className="mobile:flex-1"
            onClick={() => openModal({ kind: 'company', companyId: company.id })}
          >
            Modifica azienda
          </Button>
          <Button variant="primary" onClick={newTask} className="mobile:hidden">
            <Plus /> Nuova task
          </Button>
        </div>
        {links.length > 0 && (
          <div className="flex basis-full flex-wrap gap-1.5 pl-[74px] mobile:pl-0">
            {links.slice(0, 6).map((l, i) => (
              <ChipLink key={`${l.url}-${i}`} href={l.url}>
                <Link2 aria-hidden />
                {l.label}
              </ChipLink>
            ))}
            {links.length > 6 && <Chip onClick={() => onTab('scheda')}>+{links.length - 6}</Chip>}
          </div>
        )}
      </section>

      <div
        role="tablist"
        aria-label="Sezioni azienda"
        className="-mb-1 flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-line mobile:-mx-4 mobile:px-4"
      >
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => onTab(id)}
            onPointerEnter={id === 'setup' ? () => void loadSetup() : undefined}
            onFocus={id === 'setup' ? () => void loadSetup() : undefined}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3.5 py-2.5 font-semibold whitespace-nowrap transition-colors mobile:px-3',
              tab === id ? 'border-(--c) text-ink' : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'setup' ? (
        <Suspense fallback={<SetupSkeleton />}>
          <BrandSetup company={company} />
        </Suspense>
      ) : tab === 'scheda' ? (
        <CompanyProfileView company={company} onSetup={() => onTab('setup')} />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.6fr)] gap-3 narrow:grid-cols-2">
            <Kpi value={open.length} label="da svolgere" />
            <Kpi value={overN} label="in ritardo" hot={overN > 0} />
            <Kpi value={open.filter((t) => t.due_date === today).length} label="scadono oggi" />
            <Kpi value={fmtEst(sumEstimate(open)) || '0'} label="tempo stimato" />
            <div className="flex flex-col justify-center gap-2.5 rounded-card border border-line bg-surface px-4 py-3 narrow:col-span-2">
              <span className="text-[12.5px] text-ink-2">
                Avanzamento · {done} fatte su {tasks.length}
              </span>
              <div
                className="h-[7px] overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-label="Avanzamento"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <span className="block h-full rounded-full bg-(--c)" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(330px,1fr)] items-start gap-5 narrow:grid-cols-1">
            <Module title="Calendario" icon={<Calendar />} iconTone="company" count={`solo ${company.name}`}>
              <MonthGrid
                compact
                tasks={tasks}
                companies={view.companyById}
                colorBy="priority"
                legendCompanies={[]}
                onDayClick={(d) => openModal({ kind: 'day', date: d, source: 'company' })}
              />
            </Module>
            <Module
              title="Da svolgere"
              icon={<List />}
              count={open.length}
              className="sticky top-0 narrow:static"
              right={
                <Button variant="primary" size="icon" aria-label="Nuova task" onClick={newTask}>
                  <Plus />
                </Button>
              }
            >
              <DeadlineList tasks={open} horizon="all" inCompany />
            </Module>
          </div>

          <CompletedTable tasks={tasks} inCompany />
        </>
      )}
    </div>
  )
}

function SetupSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-4 w-80" />
      <Skeleton className="h-[290px] rounded-module" />
      <div className="grid grid-cols-2 gap-4 narrow:grid-cols-1">
        <Skeleton className="h-[260px] rounded-module" />
        <Skeleton className="h-[260px] rounded-module" />
      </div>
    </div>
  )
}

function Kpi({ value, label, hot }: { value: ReactNode; label: string; hot?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-card border bg-surface px-4 py-3',
        hot ? 'border-[rgba(255,93,115,.5)]' : 'border-line',
      )}
    >
      <b className={cn('num text-2xl leading-[1.1] font-medium', hot && 'text-danger-ink')}>{value}</b>
      <span className="text-[12.5px] text-ink-2">{label}</span>
    </div>
  )
}
