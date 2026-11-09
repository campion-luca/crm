import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'
import { filterTasks, inScope } from '@/lib/filters'
import { useToday } from '@/lib/hooks'
import type { Task } from '@/lib/types'
import { useData, useSettings } from '@/data/queries'
import { useUi } from '@/stores/ui'
import type { TaskSearch } from './search'

const clean = (s: TaskSearch): TaskSearch => ({
  ...(s.q ? { q: s.q } : {}),
  ...(s.prio ? { prio: s.prio } : {}),
  ...(s.due ? { due: s.due } : {}),
})

/** Filtri della toolbar letti e scritti nei search params della vista corrente. */
export function useTaskFilters() {
  const search = useSearch({ strict: false }) as TaskSearch
  const navigate = useNavigate()
  const set = useCallback(
    (patch: Partial<TaskSearch>) => {
      void navigate({
        to: '.',
        search: ((prev: TaskSearch) => clean({ ...prev, ...patch })) as never,
        replace: true,
      })
    },
    [navigate],
  )
  const clear = useCallback(() => {
    void navigate({ to: '.', search: {} as never, replace: true })
  }, [navigate])
  return { q: search.q ?? '', prio: search.prio, due: search.due, set, clear }
}

/** Task della vista: ambito (azienda/cartella) + filtri della toolbar + "mostra completati". */
export function useFilteredTasks(opts: { ignoreDue?: boolean } = {}): Task[] {
  const view = useData()
  const { show_done } = useSettings()
  const scope = useUi((s) => s.scope)
  const today = useToday()
  const { q, prio, due } = useTaskFilters()
  return filterTasks(
    view.tasks.filter((t) => inScope(t, scope)),
    { q, prio, due, showDone: show_done },
    { today, companyName: view.companyName, folderName: view.folderName, ignoreDue: opts.ignoreDue ?? false },
  )
}
