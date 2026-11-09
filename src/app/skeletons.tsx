import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'

/** Caricamento iniziale: stessa struttura della shell (sidebar + top bar + Home). */
export function ShellSkeleton() {
  return (
    <div
      className="grid h-dvh grid-cols-[var(--sidebar-w)_1fr] mobile:grid-cols-1"
      aria-busy="true"
      aria-label="Caricamento"
    >
      <aside className="flex flex-col gap-3 border-r border-line bg-side p-[18px] mobile:hidden">
        <div className="flex items-center gap-2.5">
          <div className="grid size-[30px] place-items-center rounded-[9px] bg-[linear-gradient(135deg,#ff6eb4,#ff9a7a)] text-[13px] font-bold text-accent-ink">
            GL
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-7" />
          ))}
        </div>
        <Skeleton className="mt-5 h-3 w-28" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-7" />
          ))}
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-col">
        <div className="flex items-center gap-3.5 border-b border-line bg-surface px-[26px] py-3.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="ml-auto h-8 w-32 rounded-ctl" />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-[22px]">
          <HomeSkeleton />
        </div>
      </main>
    </div>
  )
}

export function HomeSkeleton() {
  return (
    <div className="flex h-full max-w-[1500px] flex-col gap-4" aria-hidden>
      <div className="flex shrink-0 items-end gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.8fr)_minmax(330px,1fr)] gap-4 narrow:grid-cols-1">
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-module border border-line bg-surface">
            <div className="border-b border-line p-4">
              <Skeleton className="h-5 w-56" />
            </div>
            <div className="grid flex-1 grid-cols-7 grid-rows-6">
              {Array.from({ length: 42 }, (_, i) => (
                <div key={i} className="border-r border-b border-line p-1.5">
                  <Skeleton className="h-3 w-4" />
                  {i % 4 === 1 && <Skeleton className="mt-1.5 h-3.5" />}
                </div>
              ))}
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[82px] rounded-[14px]" />
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex-1 rounded-module border border-line bg-surface p-4">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="mt-4 flex items-center gap-3">
                <Skeleton className="size-[18px] rounded-[5px]" />
                <SkeletonText lines={2} className="flex-1" />
                <Skeleton className="h-4 w-10 rounded-full" />
              </div>
            ))}
          </div>
          <div className="h-[200px] rounded-module border border-line bg-surface p-4">
            <Skeleton className="h-5 w-28" />
            <SkeletonText lines={2} className="mt-4" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Mentre si carica il codice di una vista (code-splitting). */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Caricamento">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-card bg-surface p-3">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }, (_, j) => (
              <Skeleton key={j} className="h-16 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
