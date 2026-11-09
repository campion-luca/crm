import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  Bell,
  Building2,
  Calendar,
  ChevronRight,
  Folder as FolderIcon,
  House,
  LayoutGrid,
  List,
  LogOut,
  MoreHorizontal,
  Plus,
  Settings,
  SquareKanban,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useData, useSettings, useSyncStatus } from '@/data/queries'
import { addDaysISO } from '@/lib/dates'
import { inScope, isOver } from '@/lib/filters'
import { cn } from '@/lib/format'
import { useGoCompany, useToday } from '@/lib/hooks'
import type { Company, Folder } from '@/lib/types'
import { openModal } from '@/stores/modals'
import { isExpanded, useUi } from '@/stores/ui'
import { useDropTarget } from '@/features/dnd/hooks'
import { signOut, useAuth } from './authContext'
import type { AppPath } from './search'

// voci grandi (15px, icone da 19px); sotto i 900px (drawer) arrivano a 44px di altezza per il tocco
const navItem =
  'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[15px] text-ink-2 transition-colors hover:bg-surface hover:text-ink mobile:min-h-11 [&>svg]:size-[19px] [&>svg]:shrink-0 [&>svg]:text-ink-3'
const navOn = 'bg-accent-soft font-bold text-accent shadow-[inset_3px_0_0_var(--accent)] [&>svg]:text-accent'
const navSoft = 'bg-surface font-semibold text-ink'

function Count({ children, hot }: { children: ReactNode; hot?: boolean }) {
  return (
    <span className={cn('ml-auto num text-[12.5px]', hot ? 'text-danger' : 'text-ink-3')}>{children}</span>
  )
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2.5 pt-4 pb-2 text-xs tracking-[0.06em] text-ink-3 uppercase">
      <span>{children}</span>
      {action}
    </div>
  )
}

/**
 * Contenuto della sidebar (desktop e drawer mobile). `variant` rende unici gli id dei drop target
 * quando entrambe le versioni sono montate.
 */
export function SidebarContent({
  variant,
  onNavigate,
}: {
  variant: 'side' | 'drawer'
  onNavigate?: () => void
}) {
  const view = useData()
  const settings = useSettings()
  const today = useToday()
  const scope = useUi((s) => s.scope)
  const expanded = useUi((s) => s.expanded)
  const setExpanded = useUi((s) => s.setExpanded)
  const clearScope = useUi((s) => s.clearScope)
  const goCompany = useGoCompany()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const onCompanyPage = pathname.startsWith('/aziende/')

  const open = view.tasks.filter((t) => t.status !== 'done')
  const scoped = view.tasks.filter((t) => inScope(t, scope))
  const horizonEnd = addDaysISO(today, settings.horizon_days)
  const scadN = scoped.filter((t) => t.status !== 'done' && t.due_date && t.due_date <= horizonEnd).length
  const scadOver = scoped.some((t) => isOver(t, today))

  const go = (to: AppPath) => {
    // uscendo dal pannello azienda verso Home o Aziende si toglie il filtro
    if (onCompanyPage && (to === '/' || to === '/aziende')) clearScope()
    onNavigate?.()
  }

  // la scorciatoia da tastiera resta nel tooltip, senza la lettera accanto alla voce
  const nav = (to: AppPath, label: string, icon: ReactNode, right?: ReactNode, key?: string) => (
    <Link
      to={to}
      onClick={() => go(to)}
      title={key ? `${label} (tasto ${key})` : label}
      className={cn(navItem, pathname === to && navOn)}
      aria-current={pathname === to ? 'page' : undefined}
    >
      {icon}
      <span>{label}</span>
      {right}
    </Link>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5 px-[18px] pt-[max(18px,env(safe-area-inset-top))] pb-3">
        <div
          aria-hidden
          className="squircle grid size-9 place-items-center rounded-[10px] bg-[linear-gradient(135deg,#ff6eb4,#ff9a7a)] text-sm font-bold tracking-[-0.02em] text-accent-ink"
        >
          GL
        </div>
        <div className="min-w-0">
          <h1 className="m-0 text-[17px] font-semibold tracking-[-0.01em]">Gestionale Lavoro</h1>
          <small className="block text-[12.5px] text-ink-3">
            <span className="num">{view.companies.length}</span> aziende ·{' '}
            <span className="num">{open.length}</span> lavori aperti
          </small>
        </div>
      </div>

      <nav aria-label="Menu" className="min-h-0 flex-1 overflow-auto px-2.5 pt-1 pb-3">
        <SectionTitle>Menu</SectionTitle>
        {nav('/', 'Home', <House aria-hidden />, undefined, 'H')}
        {nav('/calendario', 'Calendario', <Calendar aria-hidden />, undefined, 'C')}
        {nav('/scadenze', 'In scadenza', <Bell aria-hidden />, <Count hot={scadOver}>{scadN}</Count>, 'S')}
        {nav('/aziende', 'Aziende', <Building2 aria-hidden />, <Count>{view.companies.length}</Count>, 'A')}
        {nav('/board', 'Board', <SquareKanban aria-hidden />, undefined, 'B')}
        {nav('/lista', 'Lista task', <List aria-hidden />, undefined, 'L')}

        <SectionTitle
          action={
            <button
              type="button"
              onClick={() => openModal({ kind: 'company' })}
              title="Nuova azienda"
              className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-xs tracking-normal text-ink-3 normal-case hover:bg-surface-2 hover:text-ink [&_svg]:size-3"
            >
              <Plus aria-hidden /> Nuova
            </button>
          }
        >
          Filtra per azienda
        </SectionTitle>
        <button
          type="button"
          onClick={() => {
            clearScope()
            if (onCompanyPage) void navigate({ to: '/' })
            onNavigate?.()
          }}
          className={cn(navItem, !scope.companyId && navSoft)}
        >
          <LayoutGrid aria-hidden />
          <span>Tutte le aziende</span>
          <Count>{open.length}</Count>
        </button>
        {!view.companies.length && (
          <div className="px-2 pt-1 pb-2 text-xs text-ink-3">Nessuna azienda. Creane una per iniziare.</div>
        )}
        {view.companies.map((c) => (
          <CompanyEntry
            key={c.id}
            company={c}
            variant={variant}
            folders={view.foldersOf(c.id)}
            openCount={view.tasksOf(c.id).filter((t) => t.status !== 'done').length}
            overCount={view.tasksOf(c.id).filter((t) => isOver(t, today)).length}
            folderCount={(fid) => open.filter((t) => t.folder_id === fid).length}
            expanded={isExpanded(expanded, c.id, scope.companyId)}
            onToggle={() => setExpanded(c.id, !isExpanded(expanded, c.id, scope.companyId))}
            active={scope.companyId === c.id && !scope.folderId}
            activeFolder={scope.folderId}
            onPick={(folderId) => {
              goCompany(c.id, folderId)
              onNavigate?.()
            }}
          />
        ))}
      </nav>

      <div className="border-t border-line px-2.5 pt-2 pb-[max(4px,env(safe-area-inset-bottom))]">
        {nav('/impostazioni', 'Impostazioni', <Settings aria-hidden />)}
        <SyncFooter />
      </div>
    </div>
  )
}

function CompanyEntry({
  company,
  variant,
  folders,
  openCount,
  overCount,
  folderCount,
  expanded,
  onToggle,
  active,
  activeFolder,
  onPick,
}: {
  company: Company
  variant: string
  folders: Folder[]
  openCount: number
  overCount: number
  folderCount: (id: string) => number
  expanded: boolean
  onToggle: () => void
  active: boolean
  activeFolder: string | null
  onPick: (folderId: string | null) => void
}) {
  const { setNodeRef: dropRef, isOver } = useDropTarget(`${variant}-co:${company.id}`, {
    kind: 'company',
    companyId: company.id,
  })
  return (
    <div className="rounded-md">
      <div
        ref={dropRef}
        className={cn(
          'group flex items-center rounded-md',
          isOver && 'outline-2 -outline-offset-2 outline-accent outline-dashed',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Nascondi' : 'Mostra'} cartelle di ${company.name}`}
          className="grid h-8 w-6 shrink-0 place-items-center rounded-[5px] text-ink-3 hover:bg-surface-2"
        >
          <ChevronRight
            className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={() => onPick(null)}
          className={cn(navItem, 'min-w-0 flex-1', active && navSoft)}
        >
          <span className="size-3 shrink-0 rounded-[4px]" style={{ background: company.color }} aria-hidden />
          <span className="truncate">{company.name}</span>
          <Count hot={overCount > 0}>
            {openCount}
            {overCount > 0 && <span className="sr-only">, {overCount} in ritardo</span>}
          </Count>
        </button>
        <button
          type="button"
          title="Modifica azienda"
          aria-label={`Modifica ${company.name}`}
          onClick={() => openModal({ kind: 'company', companyId: company.id })}
          className="grid h-7 w-6 shrink-0 place-items-center rounded-[5px] text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 [&_svg]:size-4 [@media(hover:none)]:opacity-100"
        >
          <MoreHorizontal aria-hidden />
        </button>
      </div>
      {expanded && (
        <div className="pl-6">
          {folders.map((f) => (
            <FolderEntry
              key={f.id}
              folder={f}
              variant={variant}
              count={folderCount(f.id)}
              active={activeFolder === f.id}
              onPick={() => onPick(f.id)}
            />
          ))}
          <button
            type="button"
            onClick={() => openModal({ kind: 'folder', companyId: company.id })}
            className={cn(navItem, 'py-1.5 text-[13.5px] text-ink-3 [&>svg]:size-3.5')}
          >
            <Plus aria-hidden /> Nuova cartella
          </button>
        </div>
      )}
    </div>
  )
}

function FolderEntry({
  folder,
  variant,
  count,
  active,
  onPick,
}: {
  folder: Folder
  variant: string
  count: number
  active: boolean
  onPick: () => void
}) {
  const { setNodeRef: dropRef, isOver } = useDropTarget(`${variant}-fo:${folder.id}`, {
    kind: 'folder',
    folderId: folder.id,
  })
  return (
    <div
      ref={dropRef}
      className={cn(
        'group flex items-center rounded-md',
        isOver && 'outline-2 -outline-offset-2 outline-accent outline-dashed',
      )}
    >
      <button
        type="button"
        onClick={onPick}
        className={cn(navItem, 'min-w-0 flex-1 py-1.5 text-[14px] [&>svg]:size-4', active && navSoft)}
      >
        <FolderIcon aria-hidden />
        <span className="truncate">{folder.name}</span>
        <Count>{count}</Count>
      </button>
      <button
        type="button"
        title="Modifica cartella"
        aria-label={`Modifica cartella ${folder.name}`}
        onClick={() => openModal({ kind: 'folder', folderId: folder.id })}
        className="grid h-7 w-6 shrink-0 place-items-center rounded-[5px] text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 [&_svg]:size-4 [@media(hover:none)]:opacity-100"
      >
        <MoreHorizontal aria-hidden />
      </button>
    </div>
  )
}

const SYNC_LABEL = {
  local: 'Salvato in questo browser',
  synced: 'Sincronizzato',
  syncing: 'Sincronizzo…',
  offline: 'Offline',
} as const

function SyncFooter() {
  const { state, queued } = useSyncStatus()
  const auth = useAuth()
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2 text-[12.5px] text-ink-3"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={cn(
          'size-[7px] shrink-0 rounded-full',
          state === 'synced' && 'bg-ok',
          state === 'syncing' && 'bg-warn',
          state === 'offline' && 'bg-danger',
          state === 'local' && 'bg-ink-3',
        )}
      />
      <span className="truncate">
        {SYNC_LABEL[state]}
        {state === 'offline' &&
          (queued
            ? ` · ${queued} modifich${queued === 1 ? 'a' : 'e'} in coda`
            : ' · le modifiche vanno in coda')}
      </span>
      {auth.mode === 'supabase' && (
        <button
          type="button"
          title={auth.user?.email ? `Esci (${auth.user.email})` : 'Esci'}
          aria-label="Esci"
          onClick={() => void signOut(auth.user?.id)}
          className="hit-slop ml-auto grid size-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink [&_svg]:size-3.5"
        >
          <LogOut />
        </button>
      )}
    </div>
  )
}
