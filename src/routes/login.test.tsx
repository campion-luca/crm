import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSettings } from '@/lib/supabase'

const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
}
let settings: AuthSettings = { providers: {}, signup: false }

vi.mock('@/lib/supabase', () => ({
  authSettings: () => Promise.resolve(settings),
  loadSupabase: () => Promise.resolve({ auth }),
}))

const { LoginPage } = await import('./login')

const ok = { data: {}, error: null }

beforeEach(() => {
  settings = { providers: {}, signup: false }
  for (const fn of Object.values(auth)) fn.mockReset().mockResolvedValue(ok)
})

const setup = () => {
  const user = userEvent.setup()
  render(<LoginPage />)
  return user
}

describe('LoginPage', () => {
  it('di default chiede email e password; Google e registrazione solo se attivi', async () => {
    setup()
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('button', { name: 'Accedi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ricevi un link via email/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Continua con Google')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Creane uno' })).not.toBeInTheDocument()
  })

  it('mostra Google e "Creane uno" quando Supabase li permette', async () => {
    settings = { providers: { email: true, google: true }, signup: true }
    setup()
    expect(await screen.findByRole('button', { name: /Continua con Google/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Creane uno' })).toBeInTheDocument()
  })

  it('accede con email e password', async () => {
    const user = setup()
    await user.type(screen.getByLabelText('Email'), '  luca@esempio.it ')
    await user.type(screen.getByLabelText('Password'), 'segreta123')
    await user.click(screen.getByRole('button', { name: 'Accedi' }))
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'luca@esempio.it', password: 'segreta123' })
  })

  it('controlla i campi prima di chiamare Supabase', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Accedi' }))
    expect(screen.getByText('Inserisci un indirizzo email valido')).toBeInTheDocument()
    expect(screen.getByText('Inserisci la password')).toBeInTheDocument()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('credenziali sbagliate: messaggio in italiano', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })
    const user = setup()
    await user.type(screen.getByLabelText('Email'), 'luca@esempio.it')
    await user.type(screen.getByLabelText('Password'), 'sbagliata')
    await user.click(screen.getByRole('button', { name: 'Accedi' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o password non corretti.')
  })

  it('mostra e nasconde la password', async () => {
    const user = setup()
    const field = screen.getByLabelText('Password')
    expect(field).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Mostra password' }))
    expect(field).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Nascondi password' }))
    expect(field).toHaveAttribute('type', 'password')
  })

  it('password dimenticata: manda il link per reimpostarla, tenendo l’email scritta', async () => {
    const user = setup()
    await user.type(screen.getByLabelText('Email'), 'luca@esempio.it')
    await user.click(screen.getByRole('button', { name: 'Password dimenticata?' }))
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('luca@esempio.it')
    await user.click(screen.getByRole('button', { name: 'Mandami il link' }))
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('luca@esempio.it', {
      redirectTo: window.location.origin,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('scegli la password nuova')
    await user.click(screen.getByRole('button', { name: 'Torna all’accesso' }))
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('accesso con il link via email', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: /Ricevi un link via email/ }))
    await user.type(screen.getByLabelText('Email'), 'luca@esempio.it')
    await user.click(screen.getByRole('button', { name: /Mandami il link di accesso/ }))
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'luca@esempio.it',
      options: { emailRedirectTo: window.location.origin },
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Ti ho mandato un link di accesso')
  })

  describe('registrazione', () => {
    beforeEach(() => {
      settings = { providers: { email: true }, signup: true }
    })

    const openSignup = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: 'Creane uno' }))
      expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
    }

    it(`password di almeno 8 caratteri, poi email di conferma`, async () => {
      auth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null })
      const user = setup()
      await openSignup(user)
      await user.type(screen.getByLabelText('Email'), 'nuovo@esempio.it')
      await user.type(screen.getByLabelText('Password'), 'corta')
      await user.click(screen.getByRole('button', { name: 'Crea account' }))
      expect(screen.getByRole('alert')).toHaveTextContent('almeno 8 caratteri')
      expect(auth.signUp).not.toHaveBeenCalled()

      await user.type(screen.getByLabelText('Password'), '-ma-ora-lunga')
      await user.click(screen.getByRole('button', { name: 'Crea account' }))
      expect(auth.signUp).toHaveBeenCalledWith({
        email: 'nuovo@esempio.it',
        password: 'corta-ma-ora-lunga',
        options: { emailRedirectTo: window.location.origin },
      })
      expect(await screen.findByRole('status')).toHaveTextContent('per confermare')
    })

    it('email già registrata', async () => {
      auth.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null })
      const user = setup()
      await openSignup(user)
      await user.type(screen.getByLabelText('Email'), 'luca@esempio.it')
      await user.type(screen.getByLabelText('Password'), 'abbastanza-lunga')
      await user.click(screen.getByRole('button', { name: 'Crea account' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Esiste già un account')
    })
  })
})
