import { cn } from '@/lib/format'

const chipBase =
  'inline-flex items-center gap-[5px] rounded-full border py-1 pr-[9px] pl-[7px] text-xs no-underline transition-colors [&_svg]:size-[13px] [&_svg]:shrink-0'

/** tone "company": la chip attiva prende il colore dell'azienda (--c) invece del rosa */
export function chipClass(on: boolean, tone: 'accent' | 'company' = 'accent') {
  return cn(
    chipBase,
    !on && 'border-line bg-surface text-ink-2 hover:border-ink-3 hover:text-ink',
    on && tone === 'accent' && 'border-accent bg-accent text-accent-ink',
    on && tone === 'company' && 'border-(--c) bg-(--c) text-[#111]',
  )
}
