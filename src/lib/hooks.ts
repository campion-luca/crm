import { useNavigate } from '@tanstack/react-router'
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { useUi } from '@/stores/ui'
import { todayISO } from './dates'

/** Data di oggi che si aggiorna da sola a mezzanotte (le etichette "Oggi"/"Domani" restano giuste). */
export function useToday(): string {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const id = setInterval(() => {
      const t = todayISO()
      setToday((prev) => (prev === t ? prev : t))
    }, 60_000)
    return () => clearInterval(id)
  }, [])
  return today
}

/** Ora corrente aggiornata ogni minuto (saluto, "Oggi, 15:25"). */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Contenitore che scorre (la colonna principale): serve alle liste virtualizzate. */
export const ScrollContext = createContext<HTMLElement | null>(null)
export const useScrollParent = () => useContext(ScrollContext)

/** Apre il pannello di un'azienda impostando l'ambito (azienda ed eventuale cartella). */
export function useGoCompany() {
  const navigate = useNavigate()
  return useCallback(
    (companyId: string, folderId: string | null = null) => {
      useUi.getState().setScope({ companyId, folderId })
      void navigate({ to: '/aziende/$id', params: { id: companyId }, search: {} })
    },
    [navigate],
  )
}

export async function copyText(value: string, message = `Copiato: ${value}`) {
  try {
    await navigator.clipboard.writeText(value)
    toast(message)
  } catch {
    toast(value)
  }
}

/** Media query reattiva (es. per scegliere il layout "a schermo intero" della Home). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/**
 * Schermi dove la Home sta tutta nello schermo senza scroll: i moduli si dividono l'altezza.
 * Sotto (finestre basse o strette) la pagina torna a scorrere, più leggibile.
 */
export const FIT_QUERY = '(min-width: 1150px) and (min-height: 680px)'

/** Stesso breakpoint della variante `mobile:` (sotto i 900px: barra in basso, sheet al posto delle modali). */
export const MOBILE_QUERY = '(max-width: 899.98px)'
