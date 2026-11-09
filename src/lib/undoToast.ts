import { toast } from 'sonner'

/**
 * Toast con "Annulla" al posto della conferma. `onCommit` parte una sola volta quando l'azione
 * diventa definitiva: tempo scaduto, toast chiuso (X o swipe) oppure pagina chiusa prima.
 */
export function undoToast(
  message: string,
  { onUndo, onCommit, duration = 7000 }: { onUndo: () => void; onCommit?: () => void; duration?: number },
) {
  let settled = false
  const commit = () => {
    if (settled) return
    settled = true
    window.removeEventListener('pagehide', commit)
    onCommit?.()
  }
  window.addEventListener('pagehide', commit)
  toast(message, {
    duration,
    action: {
      label: 'Annulla',
      onClick: () => {
        if (settled) return
        settled = true
        window.removeEventListener('pagehide', commit)
        onUndo()
      },
    },
    onAutoClose: commit,
    onDismiss: commit,
  })
}
