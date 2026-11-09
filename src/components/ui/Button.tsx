import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/format'

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'armed' | 'ghost'

const VARIANTS: Record<ButtonVariant, string> = {
  default: 'border-line bg-surface text-ink hover:border-ink-3',
  primary: 'border-accent bg-accent text-accent-ink hover:brightness-107',
  danger: 'border-line bg-surface text-danger hover:border-ink-3',
  armed: 'border-danger bg-danger text-[#2b0007]',
  ghost: 'border-transparent bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'md' | 'sm' | 'icon'
  ref?: React.Ref<HTMLButtonElement>
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'squircle inline-flex shrink-0 items-center justify-center gap-1.5 rounded-ctl border font-medium whitespace-nowrap transition-[border-color,background-color,filter] disabled:opacity-50 [&_svg]:size-[15px] [&_svg]:shrink-0',
        size === 'md' && 'px-3 py-[7px]',
        size === 'sm' && 'px-2.5 py-[5px] text-[12.5px]',
        size === 'icon' && 'px-2 py-1.5',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  )
}

/**
 * Conferma con doppio click: il primo click arma il pulsante ("Conferma") per 3 secondi.
 * Usato per Elimina e Svuota tutto, al posto di una modale di conferma.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Conferma',
  className,
  size,
}: {
  onConfirm: () => void
  children: ReactNode
  confirmLabel?: string
  className?: string
  size?: ButtonProps['size']
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <Button
      variant={armed ? 'armed' : 'danger'}
      size={size}
      className={className}
      aria-live="polite"
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  )
}

export function IconButton({
  className,
  size = 'md',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'md' | 'sm' }) {
  return (
    <button
      type="button"
      className={cn(
        'hit-slop grid shrink-0 place-items-center text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink',
        size === 'md'
          ? 'size-[30px] rounded-[7px] [&_svg]:size-[15px]'
          : 'size-[22px] rounded-full [&_svg]:size-3',
        className,
      )}
      {...rest}
    />
  )
}

export function LinkButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-bold text-accent hover:bg-accent-soft [&_svg]:size-3',
        className,
      )}
      {...rest}
    />
  )
}
