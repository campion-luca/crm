import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { defaultShouldDehydrateQuery, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useEffect, useState, type ReactNode } from 'react'
import type { Gateway } from './gateway'
import { resetPending, markPending } from './pending'
import { APPLY_KEY, createQueryClient, GatewayContext, subscribeGateway, type ApplyVars } from './queries'

const WEEK = 7 * 24 * 3600_000

/**
 * Un QueryClient per utente. In modalità Supabase la cache (e la coda delle modifiche fatte offline)
 * viene salvata in localStorage: al riavvio i dati compaiono subito e si riallineano in background.
 */
export function DataProvider({
  gateway,
  userId,
  children,
}: {
  gateway: Gateway
  userId: string
  children: ReactNode
}) {
  const [qc] = useState(() => {
    resetPending()
    return createQueryClient(gateway)
  })
  const [persister] = useState(() =>
    gateway.mode === 'supabase'
      ? createSyncStoragePersister({
          storage: window.localStorage,
          key: `gl-cache-${userId}`,
          throttleTime: 1000,
        })
      : null,
  )

  useEffect(() => subscribeGateway(gateway, qc), [gateway, qc])

  const tree = <GatewayContext.Provider value={gateway}>{children}</GatewayContext.Provider>

  if (!persister) return <QueryClientProvider client={qc}>{tree}</QueryClientProvider>

  return (
    <PersistQueryClientProvider
      client={qc}
      persistOptions={{
        persister,
        maxAge: WEEK,
        buster: 'v1',
        // URL firmati e anteprime dei font scadono o vivono solo in questa pagina: non si salvano
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.meta?.persist !== false && defaultShouldDehydrateQuery(q),
        },
      }}
      onSuccess={() => {
        // le modifiche rimaste in coda dalla sessione precedente ripartono
        for (const m of qc.getMutationCache().getAll()) {
          if (m.state.isPaused && m.options.mutationKey?.[0] === APPLY_KEY[0]) {
            markPending((m.state.variables as ApplyVars | undefined)?.keys ?? [])
          }
        }
        void qc.resumePausedMutations()
      }}
    >
      {tree}
    </PersistQueryClientProvider>
  )
}
