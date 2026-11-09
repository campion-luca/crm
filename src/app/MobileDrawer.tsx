import { Drawer } from 'vaul'
import { usePredictiveBack } from '@/lib/usePredictiveBack'
import { useUi } from '@/stores/ui'
import { SidebarContent } from './Sidebar'

/** 10 · Sotto i 900px la sidebar diventa un drawer chiudibile con lo swipe e con il gesto indietro. */
export function MobileDrawer() {
  const open = useUi((s) => s.drawerOpen)
  const setOpen = useUi((s) => s.setDrawerOpen)
  usePredictiveBack(open, () => setOpen(false), 'drawer')
  return (
    <Drawer.Root open={open} onOpenChange={setOpen} direction="left">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(var(--sidebar-w),85vw)] flex-col border-r border-line bg-side outline-none"
        >
          <Drawer.Title className="sr-only">Menu</Drawer.Title>
          <SidebarContent variant="drawer" onNavigate={() => setOpen(false)} />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
