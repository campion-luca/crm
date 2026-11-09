import type { Snapshot, UserSettings } from '@/lib/types'
import { emptySnapshot } from '@/lib/types'
import { applyChanges, ConstraintError, type Change } from './changes'
import { createLocalFileStore } from './files'
import { SyncError, type Gateway } from './gateway'
import { byPosition, toCompany, toFolder, toLink, toSettings, toTask } from './normalize'

export const LOCAL_DATA_KEY = 'gl-data-v1'
export const LOCAL_SETTINGS_KEY = 'gl-settings-v1'
export const LOCAL_USER_ID = 'local'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new SyncError('Spazio del browser esaurito: esporta un backup e libera spazio', false)
  }
}

function load(): Snapshot {
  const raw = read<Partial<Record<keyof Snapshot, unknown[]>>>(LOCAL_DATA_KEY)
  if (!raw) return emptySnapshot()
  const rows = (k: keyof Snapshot) => (Array.isArray(raw[k]) ? (raw[k] as Record<string, unknown>[]) : [])
  return {
    companies: rows('companies').map(toCompany).sort(byPosition),
    folders: rows('folders').map(toFolder).sort(byPosition),
    tasks: rows('tasks').map(toTask),
    links: rows('links').map(toLink),
  }
}

/**
 * Modalità locale: stessi vincoli del database (via applyChanges strict) ma tutto in localStorage.
 * Le altre schede dello stesso browser si aggiornano tramite l'evento `storage`.
 */
export function createLocalGateway(): Gateway {
  return {
    mode: 'local',
    files: createLocalFileStore(LOCAL_USER_ID),

    async fetchSnapshot() {
      return load()
    },

    async apply(changes: Change[]) {
      try {
        const { snapshot } = applyChanges(load(), changes, { strict: true, userId: LOCAL_USER_ID })
        write(LOCAL_DATA_KEY, snapshot)
      } catch (e) {
        if (e instanceof ConstraintError) throw new SyncError(e.message, false)
        throw e
      }
    },

    async fetchSettings() {
      const raw = read<Record<string, unknown>>(LOCAL_SETTINGS_KEY)
      return raw ? toSettings(raw) : null
    },

    async saveSettings(s: UserSettings) {
      write(LOCAL_SETTINGS_KEY, { ...s, user_id: LOCAL_USER_ID })
    },

    subscribe(h) {
      const onStorage = (e: StorageEvent) => {
        if (e.key === LOCAL_DATA_KEY || e.key === LOCAL_SETTINGS_KEY || e.key === null) h.onResync()
      }
      window.addEventListener('storage', onStorage)
      h.onStatus?.(true)
      return () => window.removeEventListener('storage', onStorage)
    },
  }
}
