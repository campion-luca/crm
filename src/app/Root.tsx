import { Link, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'

export function Root() {
  return (
    <>
      <Outlet />
      <Toaster
        position="bottom-center"
        visibleToasts={3}
        offset={{ bottom: 'calc(18px + var(--bottom-nav-h) + env(safe-area-inset-bottom))' }}
        mobileOffset={{ bottom: 'calc(14px + var(--bottom-nav-h) + env(safe-area-inset-bottom))' }}
        toastOptions={{ duration: 2200 }}
      />
    </>
  )
}

export function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-card border border-dashed border-line p-7 text-center text-ink-2">
      <b className="mb-1 block text-[15px] text-ink">Pagina non trovata</b>
      <Link to="/" className="font-bold text-accent">
        Torna alla Home
      </Link>
    </div>
  )
}
