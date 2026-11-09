import { Link, useRouterState } from '@tanstack/react-router'
import { Bell, Calendar, House, Menu, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useData, useSettings } from '@/data/queries'
import { addDaysISO } from '@/lib/dates'
import { inScope, isOver } from '@/lib/filters'
import { cn } from '@/lib/format'
import { useToday } from '@/lib/hooks'
import { openModal } from '@/stores/modals'
import { useUi } from '@/stores/ui'
import type { AppPath } from './search'

const item =
  'relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold text-ink-3 transition-colors [&_svg]:size-[22px]'
const itemOn = 'text-accent'

/**
 * Barra in basso sotto i 900px: le viste più usate a un tocco, "+" per una nuova task al centro
 * e "Menu" per il resto (aziende, board, lista, impostazioni, filtro per azienda).
 */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const drawerOpen = useUi((s) => s.drawerOpen)
  const setDrawerOpen = useUi((s) => s.setDrawerOpen)
  const scope = useUi((s) => s.scope)
  const view = useData()
  const settings = useSettings()
  const today = useToday()
  const end = addDaysISO(today, settings.horizon_days)
  const due = view.tasks.filter(
    (t) => t.status !== 'done' && inScope(t, scope) && !!t.due_date && t.due_date <= end,
  )
  const hot = due.some((t) => isOver(t, today))

  const tab = (to: AppPath, label: string, icon: ReactNode, badge?: ReactNode) => (
    <Link
      to={to}
      className={cn(item, pathname === to && itemOn)}
      aria-current={pathname === to ? 'page' : undefined}
    >
      {icon}
      {label}
      {badge}
    </Link>
  )

  return (
    <nav
      aria-label="Navigazione principale"
      className="hidden shrink-0 items-stretch gap-1 border-t border-line bg-side px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] mobile:flex"
    >
      {tab('/', 'Home', <House aria-hidden />)}
      {tab('/calendario', 'Calendario', <Calendar aria-hidden />)}
      <div className="flex flex-1 items-center justify-center">
        <button
          type="button"
          aria-label="Nuova task"
          onClick={() => openModal({ kind: 'task' })}
          className="squircle grid size-[52px] -translate-y-1.5 place-items-center rounded-2xl bg-accent text-accent-ink shadow-[0_6px_18px_rgba(255,110,180,.35)] active:scale-95 [&_svg]:size-6"
        >
          <Plus strokeWidth={2.5} />
        </button>
      </div>
      {tab(
        '/scadenze',
        'Scadenze',
        <Bell aria-hidden />,
        due.length > 0 && (
          <span
            className={cn(
              'absolute top-0.5 left-[calc(50%+6px)] min-w-[18px] rounded-full px-1 num text-[10.5px] leading-[18px] font-bold',
              hot ? 'bg-danger text-[#2b0007]' : 'bg-surface-2 text-ink-2',
            )}
          >
            <span className="sr-only">: </span>
            {due.length}
          </span>
        ),
      )}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-expanded={drawerOpen}
        className={cn(item, drawerOpen && itemOn)}
      >
        <Menu aria-hidden />
        Menu
      </button>
    </nav>
  )
}
