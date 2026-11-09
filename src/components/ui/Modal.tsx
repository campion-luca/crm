import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Drawer } from 'vaul'
import { cn } from '@/lib/format'
import { MOBILE_QUERY, useMediaQuery } from '@/lib/hooks'
import { IconButton } from './Button'

const SIZES = { sm: 'max-w-[420px]', confirm: 'max-w-[500px]', md: 'max-w-[640px]', wide: 'max-w-[840px]' }

interface ModalProps {
  title: ReactNode
  size?: keyof typeof SIZES
  onClose: () => void
  children: ReactNode
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
}

/**
 * Modale accessibile (focus trap, Esc, click fuori) con il bordo superiore rosa del prototipo.
 * Sotto i 900px diventa un pannello dal basso che si chiude con lo swipe (vaul).
 * Il gesto "indietro" la chiude: vedi usePredictiveBack in ModalHost.
 */
export function Modal(props: ModalProps) {
  const mobile = useMediaQuery(MOBILE_QUERY)
  return mobile ? <SheetModal {...props} /> : <DialogModal {...props} />
}

/** 10 · Bottom sheet: maniglia, swipe verso il basso per chiudere, contenuto che scorre. */
function SheetModal({ title, onClose, children, onKeyDown }: ModalProps) {
  return (
    <Drawer.Root
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Drawer.Content
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-[20px] border-t-[3px] border-t-accent bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(0,0,0,.35)] outline-none"
        >
          <div aria-hidden className="mx-auto mt-2 h-1.5 w-11 shrink-0 rounded-full bg-line" />
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-2 pb-1">
            <Drawer.Title className="m-0 min-w-0 truncate text-base font-semibold">{title}</Drawer.Title>
            <Drawer.Close asChild>
              <IconButton aria-label="Chiudi">
                <X />
              </IconButton>
            </Drawer.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [&_.px-5]:px-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function DialogModal({ title, size = 'md', onClose, children, onKeyDown }: ModalProps) {
  return (
    <Dialog.Root
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 pt-[max(6vh,env(safe-area-inset-top))] pb-[max(6vh,env(safe-area-inset-bottom))] transition-opacity duration-150 starting:opacity-0">
          <Dialog.Content
            aria-describedby={undefined}
            onKeyDown={onKeyDown}
            className={cn(
              'squircle w-full rounded-[18px] border border-t-[3px] border-line border-t-accent bg-surface shadow-[0_20px_60px_rgba(0,0,0,.3)] transition-[opacity,translate] duration-200 ease-out outline-none starting:translate-y-2 starting:opacity-0',
              SIZES[size],
            )}
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-1.5">
              <Dialog.Title className="m-0 text-base font-semibold">{title}</Dialog.Title>
              <Dialog.Close asChild>
                <IconButton aria-label="Chiudi">
                  <X />
                </IconButton>
              </Dialog.Close>
            </div>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-3.5 px-5 pt-2.5 pb-1.5', className)}>{children}</div>
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 px-5 pt-3.5 pb-[18px]">{children}</div>
}
