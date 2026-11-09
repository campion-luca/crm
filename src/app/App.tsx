import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from './authContext'
import { router } from './router'
import { ShellSkeleton } from './skeletons'

export function App() {
  const auth = useAuth()
  // login / logout: rivaluta i redirect delle route protette
  useEffect(() => {
    if (auth.status !== 'loading') void router.invalidate()
  }, [auth])
  if (auth.status === 'loading') return <ShellSkeleton />
  return <RouterProvider router={router} context={{ auth }} />
}
