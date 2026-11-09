import { lazy, Suspense, useEffect } from 'react'
import { usePredictiveBack } from '@/lib/usePredictiveBack'
import { closeModal, useModal } from '@/stores/modals'

// Le modali (con react-hook-form e zod) non servono al primo render: si scaricano a parte
// e vengono precaricate appena il browser è libero, così all'apertura sono già pronte.
const load = {
  task: () => import('@/features/tasks/TaskModal'),
  company: () => import('@/features/companies/CompanyModal'),
  folder: () => import('@/features/companies/FolderModal'),
  profile: () => import('@/features/companies/ProfileModal'),
  day: () => import('@/features/calendar/DayModal'),
  completeLinked: () => import('@/features/tasks/CompleteLinkedDialog'),
  backup: () => import('@/features/settings/BackupModal'),
  password: () => import('@/features/settings/PasswordModal'),
  brand: () => import('@/features/brand/BrandModals'),
}
const TaskModal = lazy(() => load.task().then((m) => ({ default: m.TaskModal })))
const CompanyModal = lazy(() => load.company().then((m) => ({ default: m.CompanyModal })))
const FolderModal = lazy(() => load.folder().then((m) => ({ default: m.FolderModal })))
const ProfileModal = lazy(() => load.profile().then((m) => ({ default: m.ProfileModal })))
const DayModal = lazy(() => load.day().then((m) => ({ default: m.DayModal })))
const CompleteLinkedDialog = lazy(() =>
  load.completeLinked().then((m) => ({ default: m.CompleteLinkedDialog })),
)
const BackupModal = lazy(() => load.backup().then((m) => ({ default: m.BackupModal })))
const PasswordModal = lazy(() => load.password().then((m) => ({ default: m.PasswordModal })))
const BrandColorModal = lazy(() => load.brand().then((m) => ({ default: m.BrandColorModal })))
const BrandFontModal = lazy(() => load.brand().then((m) => ({ default: m.BrandFontModal })))
const BrandGuideModal = lazy(() => load.brand().then((m) => ({ default: m.BrandGuideModal })))
const BrandLinkModal = lazy(() => load.brand().then((m) => ({ default: m.BrandLinkModal })))

function usePrefetchModals() {
  useEffect(() => {
    const run = () => {
      for (const fn of Object.values(load)) void fn()
    }
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(run, 1500)
    return () => clearTimeout(t)
  }, [])
}

function CurrentModal() {
  const modal = useModal((s) => s.modal)
  if (!modal) return null
  switch (modal.kind) {
    case 'task':
      return (
        <TaskModal
          key={modal.taskId ?? `new-${JSON.stringify(modal.preset ?? {})}`}
          taskId={modal.taskId}
          preset={modal.preset}
        />
      )
    case 'company':
      return <CompanyModal key={modal.companyId ?? 'new'} companyId={modal.companyId} />
    case 'folder':
      return (
        <FolderModal key={modal.folderId ?? 'new'} folderId={modal.folderId} companyId={modal.companyId} />
      )
    case 'profile':
      return <ProfileModal companyId={modal.companyId} />
    case 'day':
      return <DayModal date={modal.date} source={modal.source} />
    case 'completeLinked':
      return <CompleteLinkedDialog taskId={modal.taskId} />
    case 'backup':
      return <BackupModal />
    case 'password':
      return <PasswordModal recovery={modal.recovery} />
    case 'brandColor':
      return (
        <BrandColorModal key={modal.colorId ?? 'new'} companyId={modal.companyId} colorId={modal.colorId} />
      )
    case 'brandFont':
      return <BrandFontModal key={modal.fontId ?? 'new'} companyId={modal.companyId} fontId={modal.fontId} />
    case 'brandGuide':
      return <BrandGuideModal companyId={modal.companyId} />
    case 'brandLink':
      return <BrandLinkModal key={modal.docId ?? 'new'} companyId={modal.companyId} docId={modal.docId} />
  }
}

export function ModalHost() {
  const open = useModal((s) => s.modal !== null)
  usePredictiveBack(open, closeModal, 'modal')
  usePrefetchModals()
  return (
    <Suspense fallback={null}>
      <CurrentModal />
    </Suspense>
  )
}
