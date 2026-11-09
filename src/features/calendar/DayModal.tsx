import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useData, useSettings } from '@/data/queries'
import { FALLBACK_COLOR } from '@/lib/colors'
import { fmtLongDate, parseDate } from '@/lib/dates'
import { inScope, sortTasks } from '@/lib/filters'
import { prio } from '@/lib/priority'
import { closeModal, openModal } from '@/stores/modals'
import { useUi } from '@/stores/ui'
import { MiniTask } from './MiniTask'

/** Modale del giorno (calendario della Home o del pannello azienda): task del giorno + "Aggiungi task". */
export function DayModal({ date, source }: { date: string; source: 'all' | 'company' }) {
  const view = useData()
  const scope = useUi((s) => s.scope)
  const { calendar_color_by } = useSettings()
  const colorBy =
    source === 'company' ? 'priority' : calendar_color_by === 'priority' ? 'priority' : 'company'
  const items = sortTasks(
    view.tasks.filter((t) => t.due_date === date && (source === 'all' || inScope(t, scope))),
  )

  return (
    <Modal title={fmtLongDate(parseDate(date))} size="sm" onClose={closeModal}>
      <ModalBody>
        <div className="flex flex-col gap-1.5">
          {items.length ? (
            items.map((t) => (
              <MiniTask
                key={t.id}
                task={t}
                timeFirst
                draggable={false}
                color={
                  colorBy === 'priority'
                    ? prio(t.priority).color
                    : (view.companyById.get(t.company_id)?.color ?? FALLBACK_COLOR)
                }
                company={view.companyById.get(t.company_id)}
                folder={t.folder_id ? view.folderById.get(t.folder_id) : undefined}
                onOpen={(id) => openModal({ kind: 'task', taskId: id })}
              />
            ))
          ) : (
            <p className="m-0 text-xs text-ink-3">Nessuna task in questo giorno.</p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <span className="flex-1" />
        <Button onClick={closeModal}>Chiudi</Button>
        <Button
          variant="primary"
          onClick={() =>
            openModal({
              kind: 'task',
              preset: {
                due_date: date,
                ...(source === 'company' && scope.companyId
                  ? { company_id: scope.companyId, folder_id: scope.folderId }
                  : {}),
              },
            })
          }
        >
          <Plus /> Aggiungi task
        </Button>
      </ModalFooter>
    </Modal>
  )
}
