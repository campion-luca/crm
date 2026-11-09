import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/format'
import { chipClass } from './chipClass'

export function Chip({
  on = false,
  tone,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; tone?: 'accent' | 'company' }) {
  return <button type="button" aria-pressed={on} className={cn(chipClass(on, tone), className)} {...rest} />
}

export function ChipLink({ className, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a target="_blank" rel="noopener noreferrer" className={cn(chipClass(false), className)} {...rest} />
}

/** Pillola grande della Home ("3 in ritardo"). */
export function Pill({
  count,
  label,
  bg,
  fg,
  onClick,
}: {
  count: number
  label: ReactNode
  bg: string
  fg: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold transition-[filter] hover:brightness-110"
      style={{ background: bg, color: fg }}
    >
      <b className="num text-sm font-medium">{count}</b>
      {label}
    </button>
  )
}
