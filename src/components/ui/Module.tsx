import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/format'

/** Modulo della Home: card grande con intestazione, icona e trattino rosa sotto il titolo. */
export function Module({
  title,
  icon,
  iconTone = 'accent',
  count,
  right,
  children,
  className,
  style,
  headingLevel = 3,
}: {
  title?: ReactNode
  icon?: ReactNode
  iconTone?: 'accent' | 'ok' | 'company'
  count?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
  headingLevel?: 2 | 3
}) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section
      className={cn(
        'squircle flex min-w-0 flex-col overflow-hidden rounded-module border border-line bg-surface shadow-module',
        className,
      )}
      style={style}
    >
      {title != null && (
        <div className="module-dash flex flex-wrap items-center gap-2.5 border-b border-line px-[18px] pt-4 pb-3.5 mobile:px-4">
          {icon && (
            <span
              aria-hidden
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-[10px] [&_svg]:size-[17px]',
                iconTone === 'accent' && 'bg-accent-soft text-accent',
                iconTone === 'ok' && 'bg-[rgba(61,220,151,.15)] text-ok',
                iconTone === 'company' && 'bg-[color-mix(in_srgb,var(--c)_22%,transparent)] text-(--c)',
              )}
            >
              {icon}
            </span>
          )}
          <H className="m-0 text-base font-extrabold tracking-[-0.01em] whitespace-nowrap">{title}</H>
          {count != null && <span className="min-w-0 truncate num text-xs text-ink-3">{count}</span>}
          {right && <span className="ml-auto flex items-center gap-1.5">{right}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

export function ModuleFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-3.5 py-2.5 text-[12.5px] text-ink-2">
      {children}
    </div>
  )
}

/** Stato vuoto dentro un modulo ("Ancora niente qui"). */
export function EmptyState({
  title,
  children,
  className,
}: {
  title: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('px-[18px] py-[30px] text-center text-ink-2', className)}>
      <b className="mb-1 block text-[15px] text-ink">{title}</b>
      {children}
    </div>
  )
}

/** Riquadro tratteggiato (colonne vuote della board, liste senza risultati). */
export function DashedEmpty({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-line px-1.5 py-4 text-center text-[12.5px] text-ink-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}
