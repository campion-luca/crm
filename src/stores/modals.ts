import { create } from 'zustand'
import type { Priority, TaskStatus } from '@/lib/types'

export interface TaskPreset {
  company_id?: string
  folder_id?: string | null
  status?: TaskStatus
  due_date?: string
  priority?: Priority
}

/** Una sola modale alla volta, come nel prototipo. */
export type ModalState =
  | { kind: 'task'; taskId?: string; preset?: TaskPreset }
  | { kind: 'company'; companyId?: string }
  | { kind: 'folder'; folderId?: string; companyId?: string; fromTask?: boolean }
  | { kind: 'profile'; companyId: string }
  | { kind: 'day'; date: string; source: 'all' | 'company' }
  | { kind: 'completeLinked'; taskId: string }
  | { kind: 'backup' }
  | { kind: 'brandColor'; companyId: string; colorId?: string }
  | { kind: 'brandFont'; companyId: string; fontId?: string }
  | { kind: 'brandGuide'; companyId: string }
  | { kind: 'brandLink'; companyId: string; docId?: string }

interface ModalStore {
  modal: ModalState | null
  open: (m: ModalState) => void
  close: () => void
}

export const useModal = create<ModalStore>()((set) => ({
  modal: null,
  open: (modal) => set({ modal }),
  close: () => set({ modal: null }),
}))

export const openModal = (m: ModalState) => useModal.getState().open(m)
export const closeModal = () => useModal.getState().close()
