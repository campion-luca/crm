import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, loadSupabase } from '@/lib/supabase'
import { AuthContext, LOCAL_AUTH, type AuthState } from './authContext'

const fromSession = (s: Session | null): AuthState =>
  s
    ? { mode: 'supabase', status: 'signedIn', user: { id: s.user.id, email: s.user.email ?? null } }
    : { mode: 'supabase', status: 'signedOut', user: null }

/** Sessione Supabase (magic link / Google). Senza Supabase configurato: utente locale. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    isSupabaseConfigured ? { mode: 'supabase', status: 'loading', user: null } : LOCAL_AUTH,
  )

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    let unsubscribe = () => {}
    void loadSupabase().then(async (supabase) => {
      const { data } = await supabase.auth.getSession()
      if (!alive) return
      setState(fromSession(data.session))
      const sub = supabase.auth.onAuthStateChange((_event, session) => {
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
