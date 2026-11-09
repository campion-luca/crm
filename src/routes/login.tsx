import { zodResolver } from '@hookform/resolvers/zod'
import { Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { authProviders, loadSupabase } from '@/lib/supabase'

const schema = z.object({ email: z.email('Inserisci un indirizzo email valido') })
type Values = z.infer<typeof schema>

/** Accesso con magic link o con Google (Supabase Auth). */
export function LoginPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [hasGoogle, setHasGoogle] = useState(false)
  useEffect(() => {
    let alive = true
    void authProviders().then((p) => alive && setHasGoogle(Boolean(p.google)))
    return () => {
      alive = false
    }
  }, [])
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) })

  const sendLink = handleSubmit(async ({ email }) => {
    setBusy(true)
    const supabase = await loadSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) toast.error(`Invio non riuscito: ${error.message}`)
    else setSentTo(email)
  })

  const google = async () => {
    const supabase = await loadSupabase()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) toast.error(`Accesso con Google non riuscito: ${error.message}`)
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="squircle w-full max-w-[400px] rounded-module border border-t-[3px] border-line border-t-accent bg-surface p-7 shadow-module">
        <div className="mb-6 flex items-center gap-3">
          <div
            aria-hidden
            className="grid size-10 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff6eb4,#ff9a7a)] text-[15px] font-bold text-accent-ink"
          >
            GL
          </div>
          <div>
            <h1 className="m-0 text-lg font-extrabold tracking-[-0.02em]">Gestionale Lavoro</h1>
            <p className="m-0 text-[13px] text-ink-3">
              Accedi per ritrovare i tuoi lavori su ogni dispositivo
            </p>
          </div>
        </div>

        {sentTo ? (
          <div className="flex flex-col gap-3 text-ink-2" role="status">
            <Mail className="size-6 text-accent" aria-hidden />
            <p className="m-0">
              Ti ho mandato un link di accesso a <b className="text-ink">{sentTo}</b>. Aprilo da questo
              dispositivo per entrare.
            </p>
            <Button variant="ghost" className="self-start" onClick={() => setSentTo(null)}>
              Usa un altro indirizzo
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={sendLink} noValidate className="flex flex-col gap-3">
              <div className="field">
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  autoFocus
                  placeholder="nome@esempio.it"
                  className="input"
                  aria-invalid={!!formState.errors.email}
                  {...register('email')}
                />
                {formState.errors.email && (
                  <span className="text-xs text-danger" role="alert">
                    {formState.errors.email.message}
                  </span>
                )}
              </div>
              <Button type="submit" variant="primary" disabled={busy}>
                <Mail /> {busy ? 'Invio…' : 'Mandami il link di accesso'}
              </Button>
            </form>
            {hasGoogle && (
              <>
                <div className="my-4 flex items-center gap-3 text-xs text-ink-3">
                  <span className="h-px flex-1 bg-line" />
                  oppure
                  <span className="h-px flex-1 bg-line" />
                </div>
                <Button className="w-full" onClick={() => void google()}>
                  <svg viewBox="0 0 24 24" aria-hidden className="size-4">
                    <path
                      fill="#EA4335"
                      d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
                    />
                  </svg>
                  Continua con Google
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
