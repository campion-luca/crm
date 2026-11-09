import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
/** Chiave pubblica: la nuova "publishable" (sb_publishable_…) o la vecchia "anon" (eyJ…). */
const anonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as
  string | undefined

/** Senza variabili d'ambiente l'app parte in modalità locale (dati nel browser, nessun login). */
export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('xxxxxxxx'))

export type Client = SupabaseClient<Database>

let client: Client | null = null
let loading: Promise<Client> | null = null

/**
 * Il client Supabase si scarica a parte (chunk dedicato): in modalità locale non viene mai caricato,
 * con Supabase parte in parallelo al resto dell'app mentre si vede lo skeleton.
 */
export function loadSupabase(): Promise<Client> {
  if (!isSupabaseConfigured) return Promise.reject(new Error('Supabase non configurato'))
  loading ??= import('@supabase/supabase-js').then(({ createClient }) => {
    client = createClient<Database>(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      realtime: { params: { eventsPerSecond: 20 } },
    })
    return client
  })
  return loading
}

/** Client già caricato (dopo l'inizializzazione dell'auth), altrimenti null. */
export const getSupabase = (): Client | null => client
