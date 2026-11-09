import { Button } from '@/components/ui/Button'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useData } from '@/data/queries'
import { FALLBACK_COLOR } from '@/lib/colors'
import { useToday } from '@/lib/hooks'
import { childrenOf } from '@/lib/stats'
import { closeModal } from '@/stores/modals'
import { useTaskActions } from './actions'
import { DueTag, PrioPill } from './tags'

/** "Mancano N task collegate": Completa tutte / Completa solo questa / Annulla. */
export function CompleteLinkedDialog({ taskId }: { taskId: string }) {
  const view = useData()
  const today = useToday()
  const { completeLinked } = useTaskActions()
  const task = view.taskById.get(taskId)
  if (!task) return null
  const open = childrenOf(task.id, view.linkIdx, view.taskById).filter((c) => c.status !== 'done')
  const n = open.length

  return (
    <Modal title={`Mancano ${n} task collegat${n === 1 ? 'a' : 'e'}`} size="confirm" onClose={closeModal}>
      <ModalBody>
        <p className="m-0 text-xs text-ink-3">«{task.title}» ha ancora queste task da fare:</p>
        <div className="flex flex-col gap-1.5">
          {open.map((x) => (
            <div
              key={x.id}
              className="flex flex-col gap-1 rounded-md border border-l-[3px] border-line bg-surface px-[9px] py-[7px]"
              style={{ borderLeftColor: view.companyById.get(x.company_id)?.color ?? FALLBACK_COLOR }}
            >
              <span className="text-[13px] font-medium">{x.title}</span>
              <span className="flex items-center gap-1.5">
                <PrioPill p={x.priority} />
                <DueTag task={x} today={today} />
              </span>
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button onClick={closeModal}>Annulla</Button>
        <span className="flex-1" />
        <Button
          onClick={() => {
            completeLinked(task.id, 'only')
            closeModal()
          }}
        >
          Completa solo questa
        </Button>
        <Button
          variant="primary"
          autoFocus
          onClick={() => {
            completeLinked(task.id, 'all')
            closeModal()
          }}
        >
          Completa tutte
        </Button>
      </ModalFooter>
    </Modal>
  )
}
