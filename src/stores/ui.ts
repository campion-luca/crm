import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { monthOf, todayISO } from '@/lib/dates'
import type { ListGroup, Scope } from '@/lib/types'

/**
 * Stato dell'interfaccia. In localStorage restano solo le preferenze (ultima vista, ambito,
 * cartelle espanse, raggruppamento); mese del calendario e pannelli ripartono a ogni sessione.
 */
interface UiState {
  scope: Scope
  expanded: Record<string, boolean>
  listGroup: ListGroup
  lastPath: string
  calMonth: string
  calDay: string
  showAllDone: boolean
  drawerOpen: boolean
  setScope: (s: Scope) => void
  clearScope: () => void
  setExpanded: (companyId: string, open: boolean) => void
  setListGroup: (g: ListGroup) => void
  setLastPath: (p: string) => void
  setCalMonth: (m: string) => void
  selectDay: (d: string) => void
  goToday: () => void
  toggleShowAllDone: () => void
  setDrawerOpen: (open: boolean) => void
}

const safeStorage = createJSONStorage(() => {
  try {
    return window.localStorage
  } catch {
    const mem = new Map<string, string>()
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    }
  }
})

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      scope: { companyId: null, folderId: null },
      expanded: {},
      listGroup: 'priority',
      lastPath: '/',
      calMonth: monthOf(todayISO()),
      calDay: todayISO(),
      showAllDone: false,
      drawerOpen: false,
      setScope: (scope) =>
        set((s) => ({
          scope,
          expanded: scope.companyId ? { ...s.expanded, [scope.companyId]: true } : s.expanded,
        })),
      clearScope: () => set({ scope: { companyId: null, folderId: null } }),
      setExpanded: (id, open) => set((s) => ({ expanded: { ...s.expanded, [id]: open } })),
      setListGroup: (listGroup) => set({ listGroup }),
      setLastPath: (lastPath) => set({ lastPath }),
      setCalMonth: (calMonth) => set({ calMonth }),
      selectDay: (calDay) => set({ calDay, calMonth: monthOf(calDay) }),
      goToday: () => set({ calDay: todayISO(), calMonth: monthOf(todayISO()) }),
      toggleShowAllDone: () => set((s) => ({ showAllDone: !s.showAllDone })),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
    }),
    {
      name: 'gl-ui-v1',
      storage: safeStorage,
      partialize: (s) => ({
        scope: s.scope,
        expanded: s.expanded,
        listGroup: s.listGroup,
        lastPath: s.lastPath,
      }),
    },
  ),
)

/** Cartelle di un'azienda visibili nella sidebar: aperte se espanse a mano o se è l'azienda attiva. */
export const isExpanded = (
  expanded: Record<string, boolean>,
  companyId: string,
  activeCompanyId: string | null,
) => expanded[companyId] !== false && (expanded[companyId] === true || activeCompanyId === companyId)
