import { describe, expect, it } from 'vitest'
import { authErrorText, MIN_PASSWORD } from './authErrors'

describe('authErrorText', () => {
  it('traduce i codici di Supabase Auth', () => {
    expect(authErrorText({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      'Email o password non corretti.',
    )
    expect(
      authErrorText({ code: 'signup_disabled', message: 'Signups not allowed for this instance' }),
    ).toMatch(/registrazioni sono chiuse/)
    expect(authErrorText({ code: 'weak_password', message: 'Password should be…' })).toContain(
      String(MIN_PASSWORD),
    )
    expect(authErrorText({ code: 'over_email_send_rate_limit', message: 'x' })).toMatch(/qualche minuto/)
  })

  it('senza codice riconosce i messaggi noti', () => {
    expect(authErrorText({ message: 'Invalid login credentials' })).toBe('Email o password non corretti.')
    expect(authErrorText({ message: 'TypeError: Failed to fetch' })).toMatch(/Connessione assente/)
  })

  it('altrimenti lascia il messaggio originale', () => {
    expect(authErrorText({ code: 'boh', message: 'Qualcosa è andato storto' })).toBe(
      'Qualcosa è andato storto',
    )
  })
})
