import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, loadSupabase } from '@/lib/supabase'
import { openModal } from '@/stores/modals'
import { AuthContext, LOCAL_AUTH, type AuthState } from './authContext'

const fromSession = (s: Session | null): AuthState =>
  s
    ? { mode: 'supabase', status: 'signedIn', user: { id: s.user.id, email: s.user.email ?? null } }
    : { mode: 'supabase', status: 'signedOut', user: null }

/** Sessione Supabase (password, link via email, Google). Senza Supabase configurato: utente locale. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    isSupabaseConfigured ? { mode: 'supabase', status: 'loading', user: null } : LOCAL_AUTH,
  )

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    let unsubscribe = () => {}
    void loadSupabase().then((supabase) => {
      if (!alive) return
      // L'iscrizione va fatta subito, prima di qualunque await: arrivando dal link "Password dimenticata?"
      // Supabase manda PASSWORD_RECOVERY una sola volta, appena ha letto il codice dall'URL.
      const sub = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') openModal({ kind: 'password', recovery: true })
        setState((prev) => {
          const next = fromSession(session)
          return prev.user?.id === next.user?.id && prev.status === next.status ? prev : next
        })
      })
      unsubscribe = () => sub.data.subscription.unsubscribe()
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
