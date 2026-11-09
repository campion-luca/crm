import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, expect } from 'vitest'
import { actAs, asSuperuser, createTemplate, createUser } from './harness'
import type { Db } from './harness'

export const USER_A = '00000000-0000-4000-8000-00000000000a'
export const USER_B = '00000000-0000-4000-8000-00000000000b'

export const newId = (): string => randomUUID()

export const TABLES = ['companies', 'folders', 'tasks', 'task_links', 'user_settings'] as const
export type Table = (typeof TABLES)[number]

/**
 * Registra gli hook del file: un template con migrazioni e utenti A e B viene avviato una volta,
 * ogni test riceve una copia pulita (nessuno stato condiviso tra i test).
 */
export function freshDbPerTest(): () => Db {
  let template: Awaited<ReturnType<typeof createTemplate>> | undefined
  let current: Db | undefined

  beforeAll(async () => {
    template = await createTemplate(async (db) => {
      await createUser(db, USER_A)
      await createUser(db, USER_B)
    })
  })
  beforeEach(async () => {
    current = await template!.clone()
  })
  afterEach(async () => {
    await current?.close()
    current = undefined
  })
  afterAll(async () => {
    await template?.close()
  })

  return () => {
    if (!current) throw new Error('database non inizializzato: usare dentro un test')
    return current
  }
}

/** Come authenticated ma senza utente nel JWT: auth.uid() restituisce null. */
export async function actAsAuthenticatedWithoutUser(db: Db) {
  await asSuperuser(db)
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  await db.exec('set role authenticated')
}

type Values = Record<string, unknown>

/** Insert generico con il ruolo corrente; restituisce la riga creata. */
export async function insert<T extends object = Values>(
  db: Db,
  table: Table,
  values: Values = {},
): Promise<T> {
  const cols = Object.keys(values)
  const sql = cols.length
    ? `insert into public.${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning *`
    : `insert into public.${table} default values returning *`
  const res = await db.query<T>(sql, Object.values(values))
  return res.rows[0]!
}

export async function company(db: Db, values: Values = {}): Promise<string> {
  const row = await insert<{ id: string }>(db, 'companies', { name: 'Azienda', color: '#3366ff', ...values })
  return row.id
}

export async function folder(db: Db, companyId: string, values: Values = {}): Promise<string> {
  const row = await insert<{ id: string }>(db, 'folders', {
    company_id: companyId,
    name: 'Cartella',
    ...values,
  })
  return row.id
}

export async function task(db: Db, companyId: string, values: Values = {}): Promise<string> {
  const row = await insert<{ id: string }>(db, 'tasks', {
    company_id: companyId,
    title: 'Task',
    due_date: '2026-11-10',
    ...values,
  })
  return row.id
}

export async function link(db: Db, parentId: string, childId: string) {
  await insert(db, 'task_links', { parent_id: parentId, child_id: childId })
}

/** Chiama la RPC come farebbe supabase.rpc('apply_changes', { changes }). */
export function applyChanges(db: Db, changes: unknown) {
  return db.query('select public.apply_changes($1::jsonb)', [JSON.stringify(changes)])
}

export async function rows<T extends object>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows
}

export async function one<T extends object>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const res = await rows<T>(db, sql, params)
  expect(res).toHaveLength(1)
  return res[0]!
}

export async function count(db: Db, sql: string, params: unknown[] = []): Promise<number> {
  const res = await one<{ n: number }>(db, `select count(*)::int as n from (${sql}) q`, params)
  return res.n
}

/** Conta le righe di una tabella come superuser (senza RLS), poi torna al ruolo indicato. */
export async function countAll(
  db: Db,
  table: Table,
  where = 'true',
  params: unknown[] = [],
  restore?: string | null,
) {
  await asSuperuser(db)
  const n = await count(db, `select 1 from public.${table} where ${where}`, params)
  if (restore !== undefined) await actAs(db, restore)
  return n
}

/** La promise deve fallire con l'SQLSTATE indicato (ed eventualmente con un messaggio). */
export async function expectPgError(promise: Promise<unknown>, code: string, message?: RegExp) {
  const err: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(err, 'la query doveva fallire').toBeInstanceOf(Error)
  const actual = err instanceof Error && 'code' in err ? err.code : undefined
  expect(actual, err instanceof Error ? err.message : '').toBe(code)
  if (message) expect((err as Error).message).toMatch(message)
}
