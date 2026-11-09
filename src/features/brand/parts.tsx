import { Copy, Upload } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Button, IconButton, type ButtonProps } from '@/components/ui/Button'
import { cn } from '@/lib/format'
import { copyText } from '@/lib/hooks'
import { useFileDrop } from './useFileDrop'

/** Contenitore della sezione con il bordo tratteggiato mentre si trascina un file sopra. */
export function DropArea({
  onFiles,
  children,
  className,
}: {
  onFiles: (files: File[]) => void
  children: (over: boolean) => ReactNode
  className?: string
}) {
  const drop = useFileDrop(onFiles)
  return (
    <div
      {...drop.props}
      className={cn(
        'min-w-0 rounded-module transition-[outline-color]',
        drop.over && 'outline-2 outline-offset-2 outline-accent outline-dashed',
        className,
      )}
    >
      {children(drop.over)}
    </div>
  )
}

function FileInput({
  accept,
  multiple,
  onFiles,
  inputRef,
  className,
}: {
  accept?: string | undefined
  multiple?: boolean | undefined
  onFiles: (files: File[]) => void
  inputRef?: React.Ref<HTMLInputElement>
  className?: string
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      multiple={multiple}
      className={className}
      hidden={!className}
      onChange={(e) => {
        const files = [...(e.currentTarget.files ?? [])]
        e.currentTarget.value = ''
        if (files.length) onFiles(files)
      }}
    />
  )
}

/** Pulsante che apre la scelta dei file. */
export function FileButton({
  accept,
  multiple = true,
  onFiles,
  children,
  icon = false,
  size,
  variant,
  ...rest
}: Omit<ButtonProps, 'onClick'> & {
  accept?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  /** come IconButton (azioni delle card) */
  icon?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const open = () => ref.current?.click()
  return (
    <>
      {icon ? (
        <IconButton {...rest} onClick={open}>
          {children}
        </IconButton>
      ) : (
        <Button {...rest} size={size} variant={variant} onClick={open}>
          {children}
        </Button>
      )}
      <FileInput inputRef={ref} accept={accept} multiple={multiple} onFiles={onFiles} />
    </>
  )
}

/** Riquadro tratteggiato "Carica…": clic per scegliere i file, si illumina durante il trascinamento. */
export function DropTile({
  accept,
  multiple = true,
  onFiles,
  title,
  hint,
  over = false,
  icon,
  className,
}: {
  accept?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  title: string
  hint: string
  over?: boolean
  icon?: ReactNode
  className?: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-line px-4 py-6 text-center text-ink-2 transition-colors hover:border-accent has-focus-visible:border-accent',
        over && 'border-accent bg-accent-soft',
        className,
      )}
    >
      <FileInput accept={accept} multiple={multiple} onFiles={onFiles} className="sr-only" />
      <span
        aria-hidden
        className="mb-0.5 grid size-10 place-items-center rounded-xl bg-accent-soft text-accent [&_svg]:size-5"
      >
        {icon ?? <Upload />}
      </span>
      <b className="text-ink">{title}</b>
      <span className="max-w-[34ch] text-xs text-pretty text-ink-3">{hint}</span>
    </label>
  )
}

/** Riga "HEX #FFE08A": clic per copiare il valore. */
export function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      title={`Copia ${value}`}
      onClick={() => void copyText(value)}
      className="group flex min-w-0 items-center gap-1.5 rounded-md py-0.5 text-left text-xs"
    >
      <span className="w-8 shrink-0 text-[10.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate num text-[11.5px] text-ink-2 group-hover:text-accent">
        {value}
      </span>
    </button>
  )
}

export function RoleTag({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--c)_18%,transparent)] px-2 py-px text-[11px] font-semibold text-ink-2">
      {children}
    </span>
  )
}

/** Nome modificabile al clic: Invio o clic fuori per salvare, Esc per annullare. */
export function InlineEdit({
  value,
  onSave,
  label,
  className,
}: {
  value: string
  onSave: (v: string) => void
  label: string
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  if (!editing) {
    return (
      <button
        type="button"
        title="Clicca per rinominare"
        onClick={() => setEditing(true)}
        className={cn('max-w-full truncate text-left hover:text-accent', className)}
      >
        {value}
      </button>
    )
  }
  return (
    <input
      autoFocus
      aria-label={label}
      defaultValue={value}
      maxLength={80}
      className={cn('input h-7 px-1.5 py-0', className)}
      onBlur={(e) => {
        const v = e.currentTarget.value.trim()
        if (v && v !== value) onSave(v)
        setEditing(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.stopPropagation()
          e.currentTarget.value = value
          setEditing(false)
        }
      }}
    />
  )
}

/** Blocco con etichetta in maiuscoletto e pulsante copia (tono di voce, hashtag…). */
export function LabeledBlock({
  label,
  copy,
  children,
}: {
  label: string
  copy?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">{label}</span>
        {copy && (
          <IconButton
            size="sm"
            aria-label={`Copia ${label.toLowerCase()}`}
            title="Copia"
            onClick={() => void copyText(copy, 'Copiato negli appunti')}
          >
            <Copy />
          </IconButton>
        )}
      </div>
      {children}
    </div>
  )
}
