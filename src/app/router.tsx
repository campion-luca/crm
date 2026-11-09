import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  retainSearchParams,
} from '@tanstack/react-router'
import { AppLayout } from './AppLayout'
import type { AuthState } from './authContext'
import { parseDashSearch, parseTaskSearch, type TaskSearch } from './search'
import { NotFound, Root } from './Root'
import { PageSkeleton } from './skeletons'

export interface RouterContext {
  auth: AuthState
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Root,
  notFoundComponent: NotFound,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: ({ context }) => {
    if (context.auth.user) throw redirect({ to: '/' })
  },
  component: lazyRouteComponent(() => import('@/routes/login'), 'LoginPage'),
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: ({ context }) => {
    if (!context.auth.user) throw redirect({ to: '/login' })
  },
  component: AppLayout,
})

const retainFilters = { middlewares: [retainSearchParams<TaskSearch>(['q', 'prio', 'due'])] }

const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/routes/home'), 'HomePage'),
})

const calendarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/calendario',
  validateSearch: parseTaskSearch,
  search: retainFilters,
  component: lazyRouteComponent(() => import('@/routes/calendario'), 'CalendarPage'),
})

const deadlinesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/scadenze',
  component: lazyRouteComponent(() => import('@/routes/scadenze'), 'DeadlinesPage'),
})

const companiesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/aziende',
  component: lazyRouteComponent(() => import('@/routes/aziende'), 'CompaniesPage'),
})

const companyRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/aziende/$id',
  validateSearch: parseDashSearch,
  component: lazyRouteComponent(() => import('@/routes/azienda'), 'CompanyPage'),
})

const boardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/board',
  validateSearch: parseTaskSearch,
  search: retainFilters,
  component: lazyRouteComponent(() => import('@/routes/board'), 'BoardPage'),
})

const listRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/lista',
  validateSearch: parseTaskSearch,
  search: retainFilters,
  component: lazyRouteComponent(() => import('@/routes/lista'), 'ListPage'),
})

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/impostazioni',
  component: lazyRouteComponent(() => import('@/routes/impostazioni'), 'SettingsPage'),
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    homeRoute,
    calendarRoute,
    deadlinesRoute,
    companiesRoute,
    companyRoute,
    boardRoute,
    listRoute,
    settingsRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  context: { auth: undefined! },
  // 7 · pre-rendering: il codice delle viste si scarica al passaggio del mouse / focus sui link
  defaultPreload: 'intent',
  // 9 · view transitions tra le viste (document.startViewTransition dove supportato)
  defaultViewTransition: true,
  defaultPendingComponent: PageSkeleton,
  defaultPendingMs: 120,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
