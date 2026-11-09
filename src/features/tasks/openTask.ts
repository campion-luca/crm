import { openModal } from '@/stores/modals'

export const openTask = (id: string) => openModal({ kind: 'task', taskId: id })
