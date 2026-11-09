import type { CSSProperties } from 'react'
import { cn } from '@/lib/format'

/** Blocco skeleton: stessa forma del contenuto finale, mai spinner. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-2', className)} style={style} />
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${90 - ((i * 23) % 40)}%` }} />
      ))}
    </div>
  )
}
