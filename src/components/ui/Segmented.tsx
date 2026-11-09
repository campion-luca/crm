import type { ReactNode } from 'react'
import { cn } from '@/lib/format'

export interface SegOption<T> {
  value: T
  label: ReactNode
  sub?: string
  color?: string
  title?: string
}

/** Pulsanti segmentati (priorità P1…P5, stato). Frecce sinistra/destra per spostarsi. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: SegOption<T>[]
  label: string
}) {
  const move = (dir: 1 | -1) => {
    const i = options.findIndex((o) => o.value === value)
    const next = options[(i + dir + options.length) % options.length]
    if (next) onChange(next.value)
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-[5px]"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault()
          move(1)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          move(-1)
        }
      }}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-[5px] rounded-[7px] border px-[9px] py-1.5 text-[12.5px] transition-colors',
              on
                ? 'border-accent bg-accent-soft font-semibold text-ink shadow-[inset_0_0_0_1px_var(--accent)]'
                : 'border-line bg-surface text-ink-2 hover:border-ink-3 hover:text-ink',
            )}
          >
            {o.color && <span className="size-2 rounded-full" style={{ background: o.color }} aria-hidden />}
            {o.label}
            {o.sub && <span className="text-xs text-ink-3">{o.sub}</span>}
          </button>
        )
      })}
    </div>
  )
}
