import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button, ConfirmButton } from '@/components/ui/Button'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useData } from '@/data/queries'
import { COMPANY_COLORS, nextCompanyColor } from '@/lib/colors'
import { cn } from '@/lib/format'
import { useGoCompany } from '@/lib/hooks'
import { closeModal } from '@/stores/modals'
import { useCompanyActions } from './actions'

const schema = z.object({
  name: z.string().trim().min(1, "Dai un nome all'azienda").max(120, 'Nome troppo lungo'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
})
type Values = z.infer<typeof schema>

export function ColorSwatches({
  value,
  onChange,
  size = 'md',
  label = 'Colore',
}: {
  value: string
  onChange: (c: string) => void
  size?: 'md' | 'sm'
  label?: string
}) {
  return (
    <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label={label}>
      {COMPANY_COLORS.map((c) => {
        const on = c.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`Colore ${c}`}
            onClick={() => onChange(c)}
            className={cn(
              'border-2 p-0',
              size === 'md' ? 'size-[26px] rounded-[7px]' : 'size-5 rounded-md',
              on ? 'border-accent shadow-[inset_0_0_0_2px_var(--surface)]' : 'border-transparent',
            )}
            style={{ background: c }}
          />
        )
      })}
    </div>
  )
}

/** Nuova azienda / modifica: nome e colore (usato in calendario e nei filtri). */
export function CompanyModal({ companyId }: { companyId?: string }) {
  const view = useData()
  const { saveCompany, deleteCompany } = useCompanyActions()
  const goCompany = useGoCompany()
  const company = companyId ? view.companyById.get(companyId) : undefined
  const n = company ? view.tasksOf(company.id).length : 0

  const { register, control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: company?.name ?? '',
      color: company?.color ?? nextCompanyColor(view.companies.map((c) => c.color)),
    },
  })

  const submit = handleSubmit(
    (v) => {
      const id = saveCompany({ id: company?.id, name: v.name, color: v.color })
      closeModal()
      if (!company) goCompany(id)
    },
    (e) => toast(e.name?.message ?? 'Controlla i campi'),
  )

  return (
    <Modal title={company ? 'Modifica azienda' : 'Nuova azienda'} size="sm" onClose={closeModal}>
      <form onSubmit={submit} noValidate autoComplete="off">
        <ModalBody>
          <div className="field">
            <label htmlFor="co-name">Nome</label>
            <input
              id="co-name"
              autoFocus
              placeholder="es. Studio Rossi"
              className="input"
              {...register('name')}
            />
          </div>
          <div className="field">
            <span className="field-label">Colore (usato in calendario e nei filtri)</span>
            <Controller
              control={control}
              name="color"
              render={({ field }) => <ColorSwatches value={field.value} onChange={field.onChange} />}
            />
          </div>
          {company && (
            <p className="m-0 text-xs text-ink-3">
              {n} lavori collegati. Eliminando l&apos;azienda elimini anche cartelle e lavori.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          {company && (
            <ConfirmButton
              onConfirm={() => {
                deleteCompany(company.id)
                closeModal()
              }}
            >
              Elimina
            </ConfirmButton>
          )}
          <span className="flex-1" />
          <Button onClick={closeModal}>Annulla</Button>
          <Button type="submit" variant="primary">
            {company ? 'Salva' : 'Crea azienda'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
