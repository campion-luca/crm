import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useModal } from '@/stores/modals'
import { useCommandMenu } from './commandStore'

const isTyping = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * Scorciatoie globali (disattivate mentre si scrive e con una modale aperta):
 * N nuova task · / cerca · H Home · C Calendario · S In scadenza · A Aziende · B Board · L Lista · ⌘K/Ctrl+K comandi.
 * Si usa event.key, così "/" funziona anche sulla tastiera italiana (Shift+7).
 */
export function useShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = useCommandMenu.getState()
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        cmd.setOpen(!cmd.open)
        return
      }
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      if (useModal.getState().modal || cmd.open) return
      const k = e.key.toLowerCase()
      const go = (to: '/' | '/calendario' | '/scadenze' | '/aziende' | '/board' | '/lista') => {
        e.preventDefault()
        void navigate({ to })
      }
      switch (k) {
        case 'n':
          e.preventDefault()
          useModal.getState().open({ kind: 'task' })
          break
        case '/': {
          e.preventDefault()
          const search = document.getElementById('gl-search')
          if (search) search.focus()
          else cmd.setOpen(true)
          break
        }
        case 'h':
          go('/')
          break
        case 'c':
          go('/calendario')
          break
        case 's':
          go('/scadenze')
          break
        case 'a':
          go('/aziende')
          break
        case 'b':
          go('/board')
          break
        case 'l':
          go('/lista')
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
}
