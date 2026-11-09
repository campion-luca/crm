import type { Snapshot, UserSettings } from '@/lib/types'
import type { Change } from './changes'
import type { FileStore } from './files'

export type GatewayMode = 'supabase' | 'local'

export interface GatewayHandlers {
  /** modifiche arrivate da un altro dispositivo / scheda */
  onChanges: (changes: Change[]) => void
  /** è possibile che si siano perse modifiche: ricarica tutto */
  onResync: () => void
  onStatus?: (connected: boolean) => void
}

/** Accesso ai dati: Supabase (Postgres + Realtime) oppure localStorage in modalità locale. */
export interface Gateway {
  readonly mode: GatewayMode
  /** file del Setup aziendale (loghi, font, documenti) */
  readonly files: FileStore
  fetchSnapshot(): Promise<Snapshot>
  apply(changes: Change[]): Promise<void>
  fetchSettings(): Promise<UserSettings | null>
  saveSettings(settings: UserSettings): Promise<void>
  subscribe(handlers: GatewayHandlers): () => void
}

export class SyncError extends Error {
  constructor(
    message: string,
    readonly network: boolean,
  ) {
    super(message)
  }
}

export const isNetworkError = (e: unknown) => e instanceof SyncError && e.network
