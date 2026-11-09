import { useMemo } from 'react'
import type { Change } from '@/data/changes'
import { DEFAULT_SETTINGS } from '@/data/normalize'
import { useApply, useGateway, useSaveSettings, useSnapshotGetter } from '@/data/queries'
import { todayISO } from '@/lib/dates'
import { buildSeed } from '@/lib/seed'
import type { Snapshot } from '@/lib/types'
import { snapshotToChanges } from './snapshotChanges'
import { useUi } from '@/stores/ui'

export function useDataActions() {
  const apply = useApply()
  const getView = useSnapshotGetter()
  const saveSettings = useSaveSettings()
  const { files } = useGateway()

  return useMemo(() => {
    /** file del setup delle aziende eliminate, quando l'eliminazione diventa definitiva */
    const removeFilesOf = (ids: string[]) => () => {
      for (const id of ids) void files.removeCompany(id).catch(() => undefined)
    }

    /** Aggiunge le aziende di esempio in coda a quelle esistenti. */
    function loadSamples(opts: { silent?: boolean } = {}) {
      const v = getView()
      const base = v.companies.reduce((m, c) => Math.max(m, c.position + 1), 0)
      const seed = buildSeed(todayISO(), new Date(), { basePosition: base })
      apply(snapshotToChanges(seed), opts.silent ? {} : { message: 'Esempi caricati', undo: true })
    }

    function wipeAll() {
      const v = getView()
      useUi.getState().clearScope()
      if (!v.companies.length) return
      const ids = v.companies.map((c) => c.id)
      apply([{ op: 'delete', table: 'companies', ids }], {
        message: 'Dati svuotati',
        undo: true,
        onCommit: removeFilesOf(ids),
      })
    }

    /** Sostituisce tutti i dati con quelli del backup (annullabile). */
    function restoreBackup(s: Snapshot) {
      const v = getView()
      useUi.getState().clearScope()
      const changes: Change[] = []
      if (v.companies.length)
        changes.push({ op: 'delete', table: 'companies', ids: v.companies.map((c) => c.id) })
      apply([...changes, ...snapshotToChanges(s)], {
        message: 'Backup ripristinato',
        undo: true,
        onCommit: removeFilesOf(v.companies.map((c) => c.id)),
      })
    }

    /** Primo accesso: crea le preferenze e, se richiesto, carica gli esempi. */
    function completeOnboarding(withSamples: boolean) {
      saveSettings({ ...DEFAULT_SETTINGS })
      if (withSamples) loadSamples({ silent: true })
    }

    return { loadSamples, wipeAll, restoreBackup, completeOnboarding }
  }, [apply, getView, saveSettings, files])
}
