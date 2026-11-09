import { useMemo } from 'react'
import { useApply, useGateway, useSnapshotGetter } from '@/data/queries'
import { newId } from '@/lib/format'
import { emptyBrand } from '@/lib/brand'
import { emptyProfile, type CompanyProfile } from '@/lib/profile'
import type { Company, Folder } from '@/lib/types'
import { useUi } from '@/stores/ui'
import { folderSaveChanges } from './folderChanges'

export function useCompanyActions() {
  const apply = useApply()
  const getView = useSnapshotGetter()
  const { files } = useGateway()

  return useMemo(() => {
    /** Crea o aggiorna un'azienda. Restituisce l'id. */
    function saveCompany(input: { id?: string; name: string; color: string }): string {
      const v = getView()
      const name = input.name.trim().slice(0, 120)
      if (input.id && v.companyById.has(input.id)) {
        apply([{ op: 'patch', table: 'companies', id: input.id, patch: { name, color: input.color } }], {
          message: 'Azienda aggiornata',
        })
        return input.id
      }
      const row: Company = {
        id: newId(),
        user_id: '',
        name,
        color: input.color,
        position: v.companies.reduce((m, c) => Math.max(m, c.position + 1), 0),
        profile: emptyProfile(),
        brand: emptyBrand(),
        created_at: new Date().toISOString(),
      }
      apply([{ op: 'upsert', table: 'companies', rows: [row] }], { message: 'Azienda creata' })
      return row.id
    }

    function deleteCompany(id: string) {
      const ui = useUi.getState()
      if (ui.scope.companyId === id) ui.clearScope()
      apply([{ op: 'delete', table: 'companies', ids: [id] }], {
        message: 'Azienda eliminata',
        undo: true,
        // i file del setup (loghi, font, documenti) si eliminano solo quando non si può più annullare
        onCommit: () => void files.removeCompany(id).catch(() => undefined),
      })
    }

    function setColor(id: string, color: string) {
      apply([{ op: 'patch', table: 'companies', id, patch: { color } }])
    }

    function saveProfile(id: string, profile: CompanyProfile) {
      apply([{ op: 'patch', table: 'companies', id, patch: { profile } }], { message: 'Scheda salvata' })
    }

    /** Crea o aggiorna una cartella (spostandola in un'altra azienda, le task la seguono). */
    function saveFolder(
      input: { id?: string; name: string; companyId: string },
      opts: { silent?: boolean } = {},
    ): string {
      const v = getView()
      const name = input.name.trim().slice(0, 120)
      const existing = input.id ? v.folderById.get(input.id) : undefined
      if (existing) {
        const changes = folderSaveChanges(existing, v.tasks, name, input.companyId)
        apply(changes, opts.silent ? {} : { message: 'Cartella aggiornata' })
        return existing.id
      }
      const row: Folder = {
        id: newId(),
        user_id: '',
        company_id: input.companyId,
        name,
        position: v.foldersOf(input.companyId).reduce((m, f) => Math.max(m, f.position + 1), 0),
        created_at: new Date().toISOString(),
      }
      apply(
        [{ op: 'upsert', table: 'folders', rows: [row] }],
        opts.silent ? {} : { message: 'Cartella creata' },
      )
      return row.id
    }

    function deleteFolder(id: string) {
      const ui = useUi.getState()
      if (ui.scope.folderId === id) ui.setScope({ ...ui.scope, folderId: null })
      apply([{ op: 'delete', table: 'folders', ids: [id] }], { message: 'Cartella eliminata', undo: true })
    }

    return { saveCompany, deleteCompany, setColor, saveProfile, saveFolder, deleteFolder }
  }, [apply, getView, files])
}
