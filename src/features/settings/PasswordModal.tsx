import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { useAuth } from '@/app/authContext'
import { authErrorText, MIN_PASSWORD } from '@/lib/authErrors'
import { loadSupabase } from '@/lib/supabase'
import { closeModal } from '@/stores/modals'

/**
 * Imposta o cambia la password dell'account. Si apre da Impostazioni → Account
 * oppure da solo, quando si arriva dal link "Password dimenticata?" (`recovery`).
 */
export function PasswordModal({ recovery = false }: { recovery?: boolean }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const email = useAuth().user?.email ?? ''

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) {
      setError(`La password deve avere almeno ${MIN_PASSWORD} caratteri`)
      return
    }
    setBusy(true)
    try {
      const supabase = await loadSupabase()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(authErrorText(error))
        return
      }
      toast.success('Password salvata: da ora puoi entrare con email e password')
      closeModal()
    } catch (err) {
      setError(authErrorText(err instanceof Error ? err : { message: String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={recovery ? 'Scegli la nuova password' : 'Password dell’account'}
      size="sm"
      onClose={closeModal}
    >
      <form onSubmit={(e) => void submit(e)} noValidate>
        <ModalBody>
          {/* per i password manager: a quale account appartiene la password */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <p className="m-0 text-[13px] text-ink-2">
            {recovery
              ? 'Sei dentro: scegli la password che userai da ora in poi.'
              : 'Con una password entri con email e password; il link via email continua a funzionare.'}
          </p>
          <div className="field">
            <label htmlFor="new-password">Nuova password</label>
            <PasswordInput
              id="new-password"
              name="new-password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              aria-invalid={!!error}
              aria-describedby="new-password-hint"
            />
            <span
              id="new-password-hint"
              role={error ? 'alert' : undefined}
              className={error ? 'text-xs text-danger' : 'text-xs text-ink-3'}
            >
              {error ?? `Almeno ${MIN_PASSWORD} caratteri`}
            </span>
          </div>
        </ModalBody>
        <ModalFooter>
          <span className="flex-1" />
          <Button onClick={closeModal}>{recovery ? 'Più tardi' : 'Annulla'}</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Salvataggio…' : 'Salva password'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
