import { createContext, useContext } from 'react'
import { LOCAL_USER_ID } from '@/data/localGateway'
import { isSupabaseConfigured, loadSupabase } from '@/lib/supabase'

export interface AuthUser {
  id: string
  email: string | null
}

export interface AuthState {
  mode: 'local' | 'supabase'
  status: 'loading' | 'signedIn' | 'signedOut'
  user: AuthUser | null
}

export const LOCAL_AUTH: AuthState = {
  mode: 'local',
  status: 'signedIn',
  user: { id: LOCAL_USER_ID, email: null },
}

export const AuthContext = createContext<AuthState>(LOCAL_AUTH)

export const useAuth = () => useContext(AuthContext)

export async function signOut(userId: string | undefined) {
  if (!isSupabaseConfigured) return
  const supabase = await loadSupabase()
  if (userId) {
    try {
      localStorage.removeItem(`gl-cache-${userId}`)
    } catch {
      /* storage non disponibile */
    }
  }
  await supabase.auth.signOut()
}
