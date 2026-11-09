import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button, ConfirmButton } from '@/components/ui/Button'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useData } from '@/data/queries'
import { useGoCompany } from '@/lib/hooks'
import { closeModal } from '@/stores/modals'
import { useCompanyActions } from './actions'

const schema = z.object({
  name: z.string().trim().min(1, 'Dai un nome alla cartella').max(120, 'Nome troppo lungo'),
  companyId: z.string().min(1, "Scegli un'azienda"),
})
type Values = z.infer<typeof schema>

/** Nuova cartella di lavoro / modifica (spostandola in un'altra azienda, le task la seguono). */
export function FolderModal({ folderId, companyId }: { folderId?: string; companyId?: string }) {
  const view = useData()
  const { saveFolder, deleteFolder } = useCompanyActions()
  const goCompany = useGoCompany()
  const folder = folderId ? view.folderById.get(folderId) : undefined
  const n = folder ? view.tasks.filter((t) => t.folder_id === folder.id).length : 0

  const { register, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: folder?.name ?? '',
      companyId: folder?.company_id ?? companyId ?? view.companies[0]?.id ?? '',
    },
  })

  const submit = handleSubmit(
    (v) => {
      const id = saveFolder({ id: folder?.id, name: v.name, companyId: v.companyId })
      closeModal()
      if (!folder) goCompany(v.companyId, id)
    },
    (e) => toast(e.name?.message ?? e.companyId?.message ?? 'Controlla i campi'),
  )

  return (
    <Modal title={folder ? 'Modifica cartella' : 'Nuova cartella di lavoro'} size="sm" onClose={closeModal}>
      <form onSubmit={submit} noValidate autoComplete="off">
        <ModalBody>
          <div className="field">
            <label htmlFor="fo-name">Nome cartella</label>
            <input
              id="fo-name"
              autoFocus
              placeholder="es. Social dicembre, Rebranding, Sito"
              className="input"
              {...register('name')}
            />
          </div>
          <div className="field">
            <label htmlFor="fo-co">Azienda</label>
            <select id="fo-co" className="input" {...register('companyId')}>
              {view.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {folder && (
            <p className="m-0 text-xs text-ink-3">
              {n} lavori dentro. Eliminando la cartella i lavori restano nell&apos;azienda, senza cartella.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          {folder && (
            <ConfirmButton
              onConfirm={() => {
                deleteFolder(folder.id)
                closeModal()
              }}
            >
              Elimina
            </ConfirmButton>
          )}
          <span className="flex-1" />
          <Button onClick={closeModal}>Annulla</Button>
          <Button type="submit" variant="primary">
            {folder ? 'Salva' : 'Crea cartella'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
