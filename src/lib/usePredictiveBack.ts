import { useEffect, useRef } from 'react'

/**
 * 12 · Predictive back: quando un pannello (modale, sheet) si apre aggiunge una voce alla history,
 * così il gesto "indietro" del telefono o il tasto del browser lo chiude invece di cambiare pagina.
 * Chiudendolo dall'interfaccia la voce viene tolta, se nel frattempo non si è navigato altrove.
 */
export function usePredictiveBack(open: boolean, close: () => void, tag: string) {
  const pushed = useRef<string | null>(null)
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })

  useEffect(() => {
    if (open && !pushed.current) {
      window.history.pushState({ ...(window.history.state as object | null), glPanel: tag }, '')
      pushed.current = window.location.href
    } else if (!open && pushed.current) {
      const href = pushed.current
      pushed.current = null
      // Si decide al task successivo: se chiudendo il pannello è partita una navigazione
      // (es. "Crea azienda" apre il pannello dell'azienda, un link nel drawer) il router ha già
      // cambiato URL e la voce non va tolta, altrimenti history.back() annullerebbe la navigazione.
      setTimeout(() => {
        const ours =
          window.location.href === href &&
          (window.history.state as { glPanel?: string } | null)?.glPanel === tag
        if (ours) window.history.back()
      }, 0)
    }
  }, [open, tag])

  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return
      pushed.current = null
      closeRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
}
