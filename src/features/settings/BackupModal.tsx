import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button, ConfirmButton } from '@/components/ui/Button'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useDataQuery, useSettingsQuery } from '@/data/queries'
import { todayISO } from '@/lib/dates'
import { emptySnapshot } from '@/lib/types'
import { closeModal } from '@/stores/modals'
import { useDataActions } from './actions'
import { BackupError, exportBackup, parseBackup } from './backup'

/** Backup e ripristino: copia / scarica il JSON, ripristina da file o da testo incollato. */
export function BackupModal() {
  const { data } = useDataQuery()
  const { data: settings } = useSettingsQuery()
  const { restoreBackup, wipeAll } = useDataActions()
  const json = useMemo(() => exportBackup(data ?? emptySnapshot(), settings ?? null), [data, settings])
  const [input, setInput] = useState('')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      toast('Copiato negli appunti')
    } catch {
      toast('Seleziona il testo e copia con Ctrl+C')
    }
  }

  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `gestionale-backup-${todayISO()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast('Download avviato (se non parte, usa Copia)')
    } catch {
      toast('Download non disponibile qui: usa Copia')
    }
  }

  const restore = () => {
    const v = input.trim()
    if (!v) {
      toast('Incolla un backup o scegli un file')
      return
    }
    try {
      const snap = parseBackup(v, { today: todayISO() })
      restoreBackup(snap)
      closeModal()
    } catch (e) {
      toast(e instanceof BackupError ? e.message : 'Il testo non è un backup valido')
    }
  }

  return (
    <Modal title="Backup e ripristino" onClose={closeModal}>
      <ModalBody>
        <p className="m-0 text-xs text-ink-3">
          I dati si salvano da soli. Qui puoi copiarli o scaricarli come file .json, e ripristinarli da un
          backup (anche quello esportato dal vecchio prototipo HTML).
        </p>
        <div className="field">
          <label htmlFor="bk-out">Dati attuali</label>
          <textarea id="bk-out" readOnly value={json} className="input min-h-[140px] num text-[11.5px]" />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void copy()}>Copia</Button>
          <Button onClick={download}>Scarica .json</Button>
        </div>
        <div className="field">
          <label htmlFor="bk-in">Ripristina da backup</label>
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Scegli un file di backup"
            className="text-xs text-ink-2 file:mr-3 file:rounded-ctl file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-ink"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              void f.text().then((t) => {
                setInput(t)
                toast('File caricato: premi Ripristina')
              })
            }}
          />
          <textarea
            id="bk-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="…oppure incolla qui il JSON"
            className="input min-h-20 num text-[11.5px]"
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <ConfirmButton
          onConfirm={() => {
            wipeAll()
            closeModal()
          }}
        >
          Svuota tutto
        </ConfirmButton>
        <span className="flex-1" />
        <Button onClick={closeModal}>Chiudi</Button>
        <Button variant="primary" onClick={restore}>
          Ripristina
        </Button>
      </ModalFooter>
    </Modal>
  )
}
