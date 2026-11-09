import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const updateUser = vi.fn()
vi.mock('@/lib/supabase', () => ({
  loadSupabase: () => Promise.resolve({ auth: { updateUser } }),
}))
const success = vi.fn()
vi.mock('sonner', () => ({ toast: { success: (m: string) => success(m) } }))

const { PasswordModal } = await import('./PasswordModal')
const { useModal } = await import('@/stores/modals')

beforeAll(() => {
  // il Modal sceglie dialog o sheet in base alla larghezza
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia
})

beforeEach(() => {
  updateUser.mockReset().mockResolvedValue({ data: {}, error: null })
  success.mockReset()
  useModal.getState().open({ kind: 'password' })
})

describe('PasswordModal', () => {
  it('salva la nuova password e chiude', async () => {
    const user = userEvent.setup()
    render(<PasswordModal />)
    expect(screen.getByRole('dialog', { name: 'Password dell’account' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nuova password'), 'nuova-password-1')
    await user.click(screen.getByRole('button', { name: 'Salva password' }))
    expect(updateUser).toHaveBeenCalledWith({ password: 'nuova-password-1' })
    expect(success).toHaveBeenCalled()
    expect(useModal.getState().modal).toBeNull()
  })

  it('troppo corta: non chiama Supabase', async () => {
    const user = userEvent.setup()
    render(<PasswordModal />)
    await user.type(screen.getByLabelText('Nuova password'), 'corta')
    await user.click(screen.getByRole('button', { name: 'Salva password' }))
    expect(screen.getByRole('alert')).toHaveTextContent('almeno 8 caratteri')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('dal link di recupero: titolo dedicato, errori di Supabase in italiano', async () => {
    updateUser.mockResolvedValue({ data: {}, error: { code: 'same_password', message: 'x' } })
    const user = userEvent.setup()
    render(<PasswordModal recovery />)
    expect(screen.getByRole('dialog', { name: 'Scegli la nuova password' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nuova password'), 'stessa-password')
    await user.click(screen.getByRole('button', { name: 'Salva password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('uguale a quella attuale')
    expect(useModal.getState().modal).not.toBeNull()
  })
})
