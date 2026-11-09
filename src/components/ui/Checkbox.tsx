import { Check } from 'lucide-react'
import { cn } from '@/lib/format'

/** Spunta quadrata del prototipo (verde quando attiva), con area di tocco da 44px. */
export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean
  onChange: () => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        'relative grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] p-0 transition-colors before:absolute before:-inset-[13px] before:content-[""]',
        checked
          ? 'border-ok bg-ok text-[#06281b]'
          : 'border-ink-3 bg-transparent text-transparent hover:border-ok',
        className,
      )}
    >
      <Check className="size-3" strokeWidth={3} aria-hidden />
    </button>
  )
}
