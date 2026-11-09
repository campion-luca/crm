import { KeyRound, Mail } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { authErrorText, MIN_PASSWORD } from '@/lib/authErrors'
import { authSettings, loadSupabase, type AuthSettings } from '@/lib/supabase'

type Mode = 'password' | 'signup' | 'reset' | 'link'
type Sent = { kind: 'signup' | 'reset' | 'link'; email: string }

const SUBTITLE: Record<Mode, string> = {
  password: 'Accedi per ritrovare i tuoi lavori su ogni dispositivo',
  signup: 'Crea il tuo account',
  reset: 'Reimposta la password',
  link: 'Accedi senza password',
}

const INTRO: Partial<Record<Mode, string>> = {
  reset: 'Scrivi la tua email: ti mando un link per sceglierne una nuova.',
  link: 'Ti mando un link: lo apri da questo browser ed entri.',
}

const SUBMIT: Record<Mode, [idle: string, busy: string]> = {
  password: ['Accedi', 'Accesso…'],
  signup: ['Crea account', 'Creazione…'],
  reset: ['Mandami il link', 'Invio…'],
  link: ['Mandami il link di accesso', 'Invio…'],
}

const isEmail = (v: string) => z.email().safeParse(v).success

/** Link testuale (cambio modalità): area di tocco ampliata a 44px. */
function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="hit-slop font-medium text-accent hover:underline">
      {children}
    </button>
  )
}

/** Accesso con email e password, link via email o Google (Supabase Auth). */
export function LoginPage() {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)
  const [settings, setSettings] = useState<AuthSettings>({ providers: {}, signup: false })

  useEffect(() => {
    let alive = true
    void authSettings().then((s) => alive && setSettings(s))
    return () => {
      alive = false
    }
  }, [])

  const switchTo = (m: Mode) => {
    setMode(m)
    setErrors({})
    setPassword('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const mail = email.trim()
    const next: typeof errors = {}
    if (!isEmail(mail)) next.email = 'Inserisci un indirizzo email valido'
    if (mode === 'password' && !password) next.password = 'Inserisci la password'
    if (mode === 'signup' && password.length < MIN_PASSWORD)
      next.password = `La password deve avere almeno ${MIN_PASSWORD} caratteri`
    setErrors(next)
    if (next.email || next.password) return

    setBusy(true)
    try {
      const supabase = await loadSupabase()
      const origin = window.location.origin
      if (mode === 'password') {
        // a buon fine: la sessione cambia e il router porta alla Home
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
        if (error) setErrors({ form: authErrorText(error) })
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: mail,
          password,
          options: { emailRedirectTo: origin },
        })
        if (error) setErrors({ form: authErrorText(error) })
        // email già registrata: Supabase risponde "ok" ma senza identità
        else if (data.user && data.user.identities?.length === 0)
          setErrors({ form: authErrorText({ code: 'user_already_exists', message: '' }) })
        else if (!data.session) setSent({ kind: 'signup', email: mail })
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: origin })
        if (error) setErrors({ form: authErrorText(error) })
        else setSent({ kind: 'reset', email: mail })
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: mail,
          options: { emailRedirectTo: origin },
        })
        if (error) setErrors({ form: authErrorText(error) })
        else setSent({ kind: 'link', email: mail })
      }
    } catch (err) {
      setErrors({ form: authErrorText(err instanceof Error ? err : { message: String(err) }) })
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    const supabase = await loadSupabase()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setErrors({ form: authErrorText(error) })
  }

  const withPassword = mode === 'password' || mode === 'signup'
  const [idle, working] = SUBMIT[mode]

  return (
    <main className="grid min-h-dvh place-items-center px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="squircle w-full max-w-[400px] rounded-module border border-t-[3px] border-line border-t-accent bg-surface p-7 shadow-module">
        <div className="mb-6 flex items-center gap-3">
          <div
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff6eb4,#ff9a7a)] text-[15px] font-bold text-accent-ink"
          >
            GL
          </div>
          <div>
            <h1 className="m-0 text-lg font-extrabold tracking-[-0.02em]">Gestionale Lavoro</h1>
            <p className="m-0 text-[13px] text-ink-3">{SUBTITLE[mode]}</p>
          </div>
        </div>

        {sent ? (
          <div className="flex flex-col gap-3 text-ink-2" role="status">
            <Mail className="size-6 text-accent" aria-hidden />
            <p className="m-0">
              {sent.kind === 'link' && (
                <>
                  Ti ho mandato un link di accesso a <b className="text-ink">{sent.email}</b>. Aprilo da
                  questo browser per entrare.
                </>
              )}
              {sent.kind === 'reset' && (
                <>
                  Se esiste un account per <b className="text-ink">{sent.email}</b> ti è arrivato un link.
                  Aprilo da questo browser: entri e scegli la password nuova.
                </>
              )}
              {sent.kind === 'signup' && (
                <>
                  Ti ho mandato un’email a <b className="text-ink">{sent.email}</b> per confermare
                  l’indirizzo. Apri il link da questo browser ed entri.
                </>
              )}
            </p>
            <Button
              variant="ghost"
              className="self-start"
              onClick={() => {
                setSent(null)
                switchTo('password')
              }}
            >
              Torna all’accesso
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-3">
              {INTRO[mode] && <p className="m-0 text-[13px] text-ink-2">{INTRO[mode]}</p>}
              <div className="field">
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  autoFocus
                  placeholder="nome@esempio.it"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                />
                {errors.email && (
                  <span id="login-email-error" className="text-xs text-danger" role="alert">
                    {errors.email}
                  </span>
                )}
              </div>

              {withPassword && (
                <div className="field">
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor="login-password" className="text-xs font-medium text-ink-2">
                      Password
                    </label>
                    {mode === 'password' && (
                      <span className="text-xs">
                        <TextButton onClick={() => switchTo('reset')}>Password dimenticata?</TextButton>
                      </span>
                    )}
                  </div>
                  <PasswordInput
                    id="login-password"
                    name="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      errors.password
                        ? 'login-password-error'
                        : mode === 'signup'
                          ? 'login-password-hint'
                          : undefined
                    }
                  />
                  {errors.password ? (
                    <span id="login-password-error" className="text-xs text-danger" role="alert">
                      {errors.password}
                    </span>
                  ) : (
                    mode === 'signup' && (
                      <span id="login-password-hint" className="text-xs text-ink-3">
                        Almeno {MIN_PASSWORD} caratteri
                      </span>
                    )
                  )}
                </div>
              )}

              {errors.form && (
                <p
                  role="alert"
                  className="m-0 rounded-lg bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2 text-[13px] text-danger"
                >
                  {errors.form}
                </p>
              )}

              <Button type="submit" variant="primary" disabled={busy}>
                {mode === 'password' ? <KeyRound /> : <Mail />} {busy ? working : idle}
              </Button>
            </form>

            {mode === 'password' ? (
              <>
                <div className="my-4 flex items-center gap-3 text-xs text-ink-3">
                  <span className="h-px flex-1 bg-line" />
                  oppure
                  <span className="h-px flex-1 bg-line" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button className="w-full" onClick={() => switchTo('link')}>
                    <Mail /> Ricevi un link via email
                  </Button>
                  {settings.providers.google && (
                    <Button className="w-full" onClick={() => void google()}>
                      <svg viewBox="0 0 24 24" aria-hidden className="size-4">
                        <path
                          fill="#EA4335"
                          d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
                        />
                      </svg>
                      Continua con Google
                    </Button>
                  )}
                </div>
                {settings.signup && (
                  <p className="mt-5 mb-0 text-center text-[13px] text-ink-2">
                    Non hai un account? <TextButton onClick={() => switchTo('signup')}>Creane uno</TextButton>
                  </p>
                )}
              </>
            ) : (
              <p className="mt-5 mb-0 text-center text-[13px] text-ink-2">
                {mode === 'signup' ? 'Hai già un account? ' : ''}
                <TextButton onClick={() => switchTo('password')}>
                  {mode === 'signup' ? 'Accedi' : 'Accedi con email e password'}
                </TextButton>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}
