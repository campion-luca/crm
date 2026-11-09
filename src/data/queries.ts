import {
  onlineManager,
  QueryClient,
  useIsFetching,
  useIsMutating,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import type { Snapshot, UserSettings } from '@/lib/types'
import { undoToast } from '@/lib/undoToast'
import { applyChanges, mergePending, withoutKeys, type Change } from './changes'
import { isNetworkError, type Gateway } from './gateway'
import { DEFAULT_SETTINGS } from './normalize'
import { isPending, markPending, pendingKeys, unmarkPending } from './pending'
import { emptyView, viewOf, type DataView } from './view'

export const DATA_KEY = ['data'] as const
export const SETTINGS_KEY = ['settings'] as const
export const APPLY_KEY = ['apply'] as const
export const SAVE_SETTINGS_KEY = ['save-settings'] as const

export interface ApplyVars {
  changes: Change[]
  inverse: Change[]
  keys: string[]
}

export const GatewayContext = createContext<Gateway | null>(null)

export function useGateway(): Gateway {
  const g = useContext(GatewayContext)
  if (!g) throw new Error('GatewayContext mancante')
  return g
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * QueryClient con le mutazioni di default: le modifiche passano tutte da APPLY_KEY,
 * vengono eseguite in fila (scope) e, offline, restano in coda finché torna la rete.
 */
export function createQueryClient(gateway: Gateway): QueryClient {
  const networkMode = gateway.mode === 'local' ? 'always' : 'online'
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 7 * 24 * 3600_000,
        networkMode,
        retry: 2,
      },
      mutations: { networkMode },
    },
  })

  qc.setMutationDefaults(APPLY_KEY, {
    mutationFn: (v: ApplyVars) => gateway.apply(v.changes),
    scope: { id: 'db' },
    retry: (count, err) => isNetworkError(err) && count < 3,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
    onError: (err, v: ApplyVars) => {
      const cur = qc.getQueryData<Snapshot>(DATA_KEY)
      if (cur) qc.setQueryData(DATA_KEY, applyChanges(cur, v.inverse).snapshot)
      toast.error(`Modifica non salvata: ${errMsg(err)}`)
    },
    onSettled: (_d, _e, v: ApplyVars) => unmarkPending(v.keys),
  })

  qc.setMutationDefaults(SAVE_SETTINGS_KEY, {
    mutationFn: (s: UserSettings) => gateway.saveSettings(s),
    scope: { id: 'settings' },
    retry: (count, err) => isNetworkError(err) && count < 3,
    onError: (err) => {
      void qc.invalidateQueries({ queryKey: SETTINGS_KEY })
      toast.error(`Preferenze non salvate: ${errMsg(err)}`)
    },
  })

  return qc
}

/** Collega Realtime (o l'evento storage in locale) alla cache. */
export function subscribeGateway(gateway: Gateway, qc: QueryClient) {
  return gateway.subscribe({
    onChanges: (changes) => {
      const cur = qc.getQueryData<Snapshot>(DATA_KEY)
      if (!cur) return
      const incoming = changes.map((c) => withoutKeys(c, isPending)).filter((c): c is Change => !!c)
      if (incoming.length) qc.setQueryData(DATA_KEY, applyChanges(cur, incoming).snapshot)
    },
    onResync: () => {
      void qc.invalidateQueries({ queryKey: DATA_KEY })
      void qc.invalidateQueries({ queryKey: SETTINGS_KEY })
    },
  })
}

export function useDataQuery() {
  const gateway = useGateway()
  const qc = useQueryClient()
  return useQuery({
    queryKey: DATA_KEY,
    queryFn: async () =>
      mergePending(await gateway.fetchSnapshot(), qc.getQueryData(DATA_KEY), pendingKeys()),
  })
}

/** Dati + indici. Dentro la shell i dati sono già caricati (altrimenti si vede lo skeleton). */
export function useData(): DataView {
  const { data } = useDataQuery()
  return data ? viewOf(data) : emptyView()
}

export const useCompanies = () => useData().companies
export const useFolders = () => useData().folders
export const useTasks = () => useData().tasks
export const useTaskLinks = () => useData().links

export interface ApplyUiOptions {
  /** messaggio del toast */
  message?: string
  /** aggiunge "Annulla" al toast (7 secondi) */
  undo?: boolean
  /** con `undo`: quando l'azione diventa definitiva (es. eliminare i file dallo storage) */
  onCommit?: () => void
}

type Mutate = (vars: ApplyVars) => void

/**
 * Applica subito le modifiche alla cache (optimistic), le manda al server in coda
 * e restituisce le modifiche inverse. Se il server rifiuta, la cache torna indietro da sola.
 */
function runApply(qc: QueryClient, mutate: Mutate, changes: Change[], opts: ApplyUiOptions = {}): Change[] {
  const current = qc.getQueryData<Snapshot>(DATA_KEY)
  if (!current || !changes.length) return []
  const { snapshot, inverse, touched } = applyChanges(current, changes)
  qc.setQueryData(DATA_KEY, snapshot)
  markPending(touched)
  mutate({ changes, inverse, keys: touched })
  if (opts.message) {
    if (opts.undo && inverse.length) {
      undoToast(opts.message, {
        onUndo: () => runApply(qc, mutate, inverse, { message: 'Annullato' }),
        onCommit: opts.onCommit,
      })
    } else {
      toast(opts.message)
    }
  }
  return inverse
}

export function useApply() {
  const qc = useQueryClient()
  const { mutate } = useMutation<unknown, Error, ApplyVars>({ mutationKey: APPLY_KEY })
  return useCallback(
    (changes: Change[], opts?: ApplyUiOptions) => runApply(qc, mutate, changes, opts),
    [qc, mutate],
  )
}

/** Legge lo snapshot corrente fuori dal render (nei gestori di eventi). */
export function useSnapshotGetter() {
  const qc = useQueryClient()
  return useCallback(() => {
    const s = qc.getQueryData<Snapshot>(DATA_KEY)
    return s ? viewOf(s) : emptyView()
  }, [qc])
}

export function useSettingsQuery() {
  const gateway = useGateway()
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => gateway.fetchSettings() })
}

export function useSettings(): UserSettings {
  const { data } = useSettingsQuery()
  return data ?? { ...DEFAULT_SETTINGS, user_id: '' }
}

export function useSaveSettings() {
  const qc = useQueryClient()
  const { mutate } = useMutation<unknown, Error, UserSettings>({ mutationKey: SAVE_SETTINGS_KEY })
  return useCallback(
    (patch: Partial<UserSettings>) => {
      const cur = qc.getQueryData<UserSettings | null>(SETTINGS_KEY) ?? { ...DEFAULT_SETTINGS, user_id: '' }
      const next = { ...cur, ...patch }
      qc.setQueryData(SETTINGS_KEY, next)
      mutate(next)
    },
    [qc, mutate],
  )
}

export type SyncState = 'local' | 'synced' | 'syncing' | 'offline'

const subscribeOnline = (cb: () => void) => onlineManager.subscribe(cb)
const getOnline = () => onlineManager.isOnline()

export function useSyncStatus(): { state: SyncState; queued: number } {
  const gateway = useGateway()
  const online = useSyncExternalStore(subscribeOnline, getOnline)
  const mutating = useIsMutating()
  const fetching = useIsFetching()
  const queued = useMutationState({
    filters: { status: 'pending', predicate: (m) => m.state.isPaused },
  }).length
  if (gateway.mode === 'local') return { state: 'local', queued: 0 }
  if (!online) return { state: 'offline', queued }
  if (mutating || fetching) return { state: 'syncing', queued }
  return { state: 'synced', queued: 0 }
}
