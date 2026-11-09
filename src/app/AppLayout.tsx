import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { DataProvider } from '@/data/DataProvider'
import { createLocalGateway } from '@/data/localGateway'
import { useDataQuery, useSaveSettings, useSettingsQuery } from '@/data/queries'
import { createSupabaseGateway } from '@/data/supabaseGateway'
import { ScrollContext } from '@/lib/hooks'
import { getSupabase } from '@/lib/supabase'
import { useUi } from '@/stores/ui'
import { DndProvider } from '@/features/dnd/DndProvider'
import { useAuth } from './authContext'
import { BottomNav } from './BottomNav'
import { useCommandMenu } from './commandStore'
import { ModalHost } from './ModalHost'
import { Onboarding } from './Onboarding'
import { FILTER_PATHS, type AppPath } from './search'
import { useShortcuts } from './shortcuts'
import { SidebarContent } from './Sidebar'

const CommandDialog = lazy(() => import('./CommandMenu').then((m) => ({ default: m.CommandDialog })))
const MobileDrawer = lazy(() => import('./MobileDrawer').then((m) => ({ default: m.MobileDrawer })))
import { ShellSkeleton } from './skeletons'
import { Summary, Toolbar } from './Toolbar'
import { TopBar } from './TopBar'

/** Layout delle pagine protette: dati dell'utente (Supabase o locale) + shell. */
export function AppLayout() {
  const auth = useAuth()
  const userId = auth.user!.id
  const gateway = useMemo(() => {
    // con Supabase l'auth ha già caricato il client prima di arrivare qui
    const client = auth.mode === 'supabase' ? getSupabase() : null
    return client ? createSupabaseGateway(client, userId) : createLocalGateway()
  }, [auth.mode, userId])
  return (
    <DataProvider key={userId} gateway={gateway} userId={userId}>
      <Shell />
    </DataProvider>
  )
}

function Shell() {
  const data = useDataQuery()
  const settings = useSettingsQuery()
  const saveSettings = useSaveSettings()
  const hasData = !!data.data?.companies.length
  const missingSettings = settings.isSuccess && settings.data === null

  // dati già presenti ma nessuna preferenza salvata: le crea senza passare dall'onboarding
  useEffect(() => {
    if (missingSettings && hasData) saveSettings({})
  }, [missingSettings, hasData, saveSettings])

  if (data.isPending || settings.isPending) return <ShellSkeleton />
  if (!data.data) {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <div className="max-w-md rounded-card border border-dashed border-line p-7 text-center text-ink-2">
          <b className="mb-1 block text-[15px] text-ink">Non riesco a caricare i dati</b>
          <p className="mt-0 mb-4 text-[13px]">
            {data.error instanceof Error ? data.error.message : 'Errore di rete'}
          </p>
          <Button variant="primary" onClick={() => void data.refetch()}>
            Riprova
          </Button>
        </div>
      </main>
    )
  }
  if (missingSettings && !hasData) return <Onboarding />
  return (
    <DndProvider>
      <Frame />
    </DndProvider>
  )
}

const RESTORABLE: AppPath[] = [
  '/',
  '/calendario',
  '/scadenze',
  '/aziende',
  '/board',
  '/lista',
  '/impostazioni',
]

/** Ricorda l'ultima vista e la riapre al primo avvio della sessione. */
function useLastView(pathname: string) {
  const navigate = useNavigate()
  const restored = useRef(false)
  useEffect(() => {
    if (!restored.current) {
      restored.current = true
      const last = useUi.getState().lastPath as AppPath
      if (pathname === '/' && last !== '/' && RESTORABLE.includes(last)) {
        void navigate({ to: last, replace: true })
        return
      }
    }
    if ((RESTORABLE as string[]).includes(pathname)) useUi.getState().setLastPath(pathname)
  }, [pathname, navigate])
}

function Frame() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // elemento (non ref) così le liste virtualizzate si ri-renderizzano quando è disponibile
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null)
  const showFilters = (FILTER_PATHS as readonly string[]).includes(pathname)
  useShortcuts()
  useLastView(pathname)

  useEffect(() => {
    scrollEl?.scrollTo({ top: 0 })
  }, [pathname, scrollEl])

  return (
    <div className="grid h-dvh grid-cols-[var(--sidebar-w)_1fr] mobile:grid-cols-1">
      <a
        href="#main"
        className="sr-only z-50 rounded-ctl bg-accent px-3 py-2 font-bold text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Vai al contenuto
      </a>
      <aside className="flex min-h-0 flex-col border-r border-line bg-side mobile:hidden">
        <SidebarContent variant="side" />
      </aside>
      <LazyDrawer />
      <main className="flex min-h-0 min-w-0 flex-col">
        <TopBar />
        {showFilters && (
          <>
            <Toolbar />
            <Summary />
          </>
        )}
        <ScrollContext.Provider value={scrollEl}>
          <section
            id="main"
            ref={setScrollEl}
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-auto px-[22px] pt-3.5 pb-[max(22px,env(safe-area-inset-bottom))] outline-none mobile:px-4 mobile:pb-6"
          >
            <Outlet />
          </section>
        </ScrollContext.Provider>
        <BottomNav />
      </main>
      <ModalHost />
      <LazyCommandMenu />
    </div>
  )
}

/** cmdk si scarica solo alla prima apertura del command menu. */
function LazyCommandMenu() {
  const open = useCommandMenu((s) => s.open)
  if (!open) return null
  return (
    <Suspense fallback={null}>
      <CommandDialog />
    </Suspense>
  )
}

/** vaul (drawer mobile) si scarica solo alla prima apertura del menu. */
function LazyDrawer() {
  const open = useUi((s) => s.drawerOpen)
  const [used, setUsed] = useState(open)
  if (open && !used) setUsed(true)
  if (!used) return null
  return (
    <Suspense fallback={null}>
      <MobileDrawer />
    </Suspense>
  )
}
