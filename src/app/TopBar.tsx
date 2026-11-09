import { useNavigate, useParams, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, Plus, X } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Kbd } from '@/components/ui/Module'
import { useData } from '@/data/queries'
import { openModal } from '@/stores/modals'
import { cn } from '@/lib/format'
import { useUi } from '@/stores/ui'

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/calendario': 'Calendario',
  '/scadenze': 'In scadenza',
  '/aziende': 'Aziende',
  '/board': 'Board',
  '/lista': 'Lista task',
  '/impostazioni': 'Impostazioni',
}

/** Titolo della vista, chip dell'ambito con ×, suggerimento scorciatoie e "+ Nuova task". */
export function TopBar() {
  const view = useData()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const params = useParams({ strict: false }) as { id?: string }
  const scope = useUi((s) => s.scope)
  const clearScope = useUi((s) => s.clearScope)
  const navigate = useNavigate()

  const isCompanyPage = pathname.startsWith('/aziende/') && !!params.id
  const company = scope.companyId ? view.companyById.get(scope.companyId) : undefined
  const folder = scope.folderId ? view.folderById.get(scope.folderId) : undefined
  const pageCompany = isCompanyPage ? view.companyById.get(params.id!) : undefined
  const scoped = !isCompanyPage && pathname !== '/aziende' && pathname !== '/impostazioni'
  const title = isCompanyPage ? (pageCompany?.name ?? 'Azienda') : (TITLES[pathname] ?? '')

  return (
    <header className="flex flex-wrap items-center gap-3.5 border-b border-line bg-surface px-[26px] pt-[max(14px,env(safe-area-inset-top))] pb-3.5 mobile:flex-nowrap mobile:gap-2 mobile:px-4 mobile:pb-3">
      <div className="flex min-w-0 items-center gap-2">
        {isCompanyPage && (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Torna alla Home"
              onClick={() => {
                clearScope()
                void navigate({ to: '/' })
              }}
            >
              <ChevronLeft />
            </Button>
            {pageCompany && (
              <span
                className="size-3 shrink-0 rounded-[3px]"
                style={{ background: pageCompany.color }}
                aria-hidden
              />
            )}
          </>
        )}
        <h2 className="m-0 truncate text-lg font-semibold tracking-[-0.015em] mobile:text-[17px]">
          {title}
          {isCompanyPage && folder && folder.company_id === params.id && (
            <span className="text-[13px] font-normal whitespace-nowrap text-ink-3"> / {folder.name}</span>
          )}
        </h2>
        {scoped && (
          <span
            className={cn(
              'inline-flex min-w-0 items-center gap-[7px] rounded-full bg-surface-2 py-1 pr-1.5 pl-3 text-[13px] font-semibold whitespace-nowrap text-ink-2',
              // su telefono il chip compare solo quando c'è davvero un filtro
              !company && 'mobile:hidden',
            )}
          >
            {company && (
              <span className="size-3 rounded-[3px]" style={{ background: company.color }} aria-hidden />
            )}
            <span className="min-w-0 truncate">
              {company ? (folder ? `${company.name} / ${folder.name}` : company.name) : 'Tutte le aziende'}
            </span>
            {company && (
              <IconButton
                size="sm"
                title="Togli filtro"
                aria-label="Togli filtro azienda"
                onClick={clearScope}
              >
                <X />
              </IconButton>
            )}
          </span>
        )}
      </div>
      <span className="ml-auto text-[11.5px] text-ink-3 mobile:hidden">
        <Kbd>N</Kbd> nuovo · <Kbd>/</Kbd> cerca
      </span>
      {/* su telefono la nuova task è il "+" della barra in basso */}
      <Button variant="primary" className="mobile:hidden" onClick={() => openModal({ kind: 'task' })}>
        <Plus /> Nuova task
      </Button>
    </header>
  )
}
