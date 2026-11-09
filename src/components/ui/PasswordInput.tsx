import { Eye, EyeOff } from 'lucide-react'
import { useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/format'

/** Campo password con il pulsante "mostra/nascondi" (al posto del campo "ripeti password"). */
export function PasswordInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  autoComplete: 'current-password' | 'new-password'
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn('input pr-11', className)}
      />
      <button
        type="button"
        aria-label={show ? 'Nascondi password' : 'Mostra password'}
        aria-pressed={show}
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[7px] text-ink-3 hover:text-ink focus-visible:text-ink [&_svg]:size-4"
      >
        {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </button>
    </div>
  )
}
