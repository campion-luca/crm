import type { Change } from '@/data/changes'
import type { Folder, Task } from '@/lib/types'

/**
 * Modifiche per rinominare / spostare una cartella. Se cambia azienda, le sue task la seguono.
 * Il database verifica che cartella e azienda di una task coincidano, quindi lo spostamento avviene
 * in tre passi validi in entrambe le direzioni (anche l'inverso usato da rollback e annulla):
 * task staccate dalla cartella → cartella spostata → task riagganciate nella nuova azienda.
 */
export function folderSaveChanges(folder: Folder, tasks: Task[], name: string, companyId: string): Change[] {
  const folderPatch: Change = {
    op: 'patch',
    table: 'folders',
    id: folder.id,
    patch: { name, company_id: companyId },
  }
  if (folder.company_id === companyId) return [folderPatch]
  const moved = tasks.filter((t) => t.folder_id === folder.id)
  return [
    ...moved.map((t): Change => ({ op: 'patch', table: 'tasks', id: t.id, patch: { folder_id: null } })),
    folderPatch,
    ...moved.map((t): Change => ({
      op: 'patch',
      table: 'tasks',
      id: t.id,
      patch: { company_id: companyId, folder_id: folder.id },
    })),
  ]
}
