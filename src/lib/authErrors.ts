/** Lunghezza minima per le password nuove (Supabase di default chiede 6 caratteri: qui si è più severi). */
export const MIN_PASSWORD = 8

const TEXT: Record<string, string> = {
  invalid_credentials: 'Email o password non corretti.',
  email_not_confirmed: 'Prima devi confermare l’email: apri il link che ti è arrivato.',
  signup_disabled: 'Le registrazioni sono chiuse: accedi con un account esistente.',
  user_already_exists: 'Esiste già un account con questa email: accedi o reimposta la password.',
  email_exists: 'Esiste già un account con questa email: accedi o reimposta la password.',
  weak_password: `Password troppo debole: usa almeno ${MIN_PASSWORD} caratteri, meglio se con lettere e numeri.`,
  same_password: 'La nuova password è uguale a quella attuale.',
  reauthentication_needed: 'Per sicurezza esci, rientra e riprova a cambiare la password.',
  over_email_send_rate_limit: 'Troppe email in poco tempo: riprova tra qualche minuto.',
  over_request_rate_limit: 'Troppi tentativi: riprova tra qualche minuto.',
  email_address_not_authorized:
    'Questa email non può ricevere messaggi: senza un server di posta Supabase scrive solo ai membri del progetto.',
  email_address_invalid: 'Indirizzo email non valido.',
  otp_expired: 'Il link è scaduto o è già stato usato: chiedine uno nuovo.',
  user_banned: 'Questo account è bloccato.',
}

/** Messaggio in italiano per un errore di Supabase Auth (codice `error.code`, altrimenti il testo originale). */
export function authErrorText(error: { code?: string | undefined; message: string }): string {
  if (error.code && TEXT[error.code]) return TEXT[error.code]!
  if (/invalid login credentials/i.test(error.message)) return TEXT.invalid_credentials!
  if (/signups? not allowed/i.test(error.message)) return TEXT.signup_disabled!
  if (/failed to fetch|network/i.test(error.message))
    return 'Connessione assente: riprova quando torna la rete.'
  return error.message
}
