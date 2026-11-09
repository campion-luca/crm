// @vitest-environment node
// Criterio di accettazione: "Nessuna query restituisce dati di un altro utente".
import { beforeEach, describe, expect, it } from 'vitest'
import { actAs, asSuperuser } from './harness'
import type { Db } from './harness'
import {
  TABLES,
  USER_A,
  USER_B,
  actAsAuthenticatedWithoutUser,
  applyChanges,
  company,
  count,
  countAll,
  expectPgError,
  folder,
  insert,
  link,
  newId,
  rows,
  task,
  freshDbPerTest,
} from './fixtures'
import type { Table } from './fixtures'

interface Owned {
  user: string
  company: string
  folder: string
  task: string
  task2: string
}

/** Ogni utente possiede almeno una riga in tutte e 5 le tabelle. */
async function seed(db: Db, user: string): Promise<Owned> {
  await actAs(db, user)
  const c = await company(db, { name: `Azienda ${user.slice(-1)}` })
  const f = await folder(db, c)
  const t = await task(db, c, { folder_id: f, title: 'Con cartella' })
  const t2 = await task(db, c, { title: 'Senza cartella' })
  await link(db, t, t2)
  await insert(db, 'user_settings')
  return { user, company: c, folder: f, task: t, task2: t2 }
}

const EXPECTED_ROWS: Record<Table, number> = {
  companies: 1,
  folders: 1,
  tasks: 2,
  task_links: 1,
  user_settings: 1,
}

const keyOf = (o: Owned): Record<Table, { where: string; params: unknown[] }> => ({
  companies: { where: 'id = $1', params: [o.company] },
  folders: { where: 'id = $1', params: [o.folder] },
  tasks: { where: 'id = $1', params: [o.task] },
  task_links: { where: 'parent_id = $1 and child_id = $2', params: [o.task, o.task2] },
  user_settings: { where: 'user_id = $1', params: [o.user] },
})

const HARMLESS_SET: Record<Table, string> = {
  companies: `name = 'modificata'`,
  folders: `name = 'modificata'`,
  tasks: `title = 'modificata'`,
  task_links: 'child_id = child_id',
  user_settings: 'horizon_days = 60',
}

/** Tutte le righe di un utente, lette come superuser; poi torna al ruolo indicato. */
async function snapshot(db: Db, user: string, restore: string | null): Promise<unknown[]> {
  await asSuperuser(db)
  const out: unknown[] = []
  for (const t of TABLES) {
    const res = await rows<{ r: unknown }>(
      db,
      `select to_jsonb(x) as r from public.${t} x where user_id = $1 order by x::text`,
      [user],
    )
    out.push(res.map((r) => r.r))
  }
  await actAs(db, restore)
  return out
}

const getDb = freshDbPerTest()
let a: Owned
let b: Owned

beforeEach(async () => {
  const db = getDb()
  b = await seed(db, USER_B)
  a = await seed(db, USER_A)
})

describe('RLS: un utente autenticato vede e modifica solo le proprie righe', () => {
  beforeEach(async () => {
    await actAs(getDb(), USER_A)
  })

  it.each(TABLES)('%s: SELECT restituisce solo le righe di A', async (table) => {
    const db = getDb()
    const res = await rows<{ user_id: string }>(db, `select user_id from public.${table}`)
    expect(res).toHaveLength(EXPECTED_ROWS[table])
    expect(res.every((r) => r.user_id === USER_A)).toBe(true)
    // le righe di B esistono davvero: il test non è vacuo
    expect(await countAll(db, table, 'user_id = $1', [USER_B], USER_A)).toBe(EXPECTED_ROWS[table])
  })

  it.each(TABLES)('%s: le righe di B non sono leggibili nemmeno cercandole per chiave', async (table) => {
    const db = getDb()
    const { where, params } = keyOf(b)[table]
    expect(await count(db, `select 1 from public.${table} where ${where}`, params)).toBe(0)
  })

  it.each(TABLES)('%s: UPDATE sulle righe di B tocca 0 righe', async (table) => {
    const db = getDb()
    const before = await snapshot(db, USER_B, USER_A)
    const { where, params } = keyOf(b)[table]
    const res = await db.query(`update public.${table} set ${HARMLESS_SET[table]} where ${where}`, params)
    expect(res.affectedRows).toBe(0)
    expect(await snapshot(db, USER_B, USER_A)).toEqual(before)
  })

  it.each(TABLES)('%s: DELETE sulle righe di B tocca 0 righe', async (table) => {
    const db = getDb()
    const before = await snapshot(db, USER_B, USER_A)
    const { where, params } = keyOf(b)[table]
    const res = await db.query(`delete from public.${table} where ${where}`, params)
    expect(res.affectedRows).toBe(0)
    expect(await snapshot(db, USER_B, USER_A)).toEqual(before)
  })

  it('UPDATE e DELETE senza filtro toccano solo le righe di A', async () => {
    const db = getDb()
    const before = await snapshot(db, USER_B, USER_A)
    for (const table of TABLES) {
      const res = await db.query(`update public.${table} set ${HARMLESS_SET[table]}`)
      expect(res.affectedRows, table).toBe(EXPECTED_ROWS[table])
    }
    // ordine figli -> padri, così ogni delete conta solo le righe sue e non quelle in cascade
    for (const table of ['task_links', 'tasks', 'folders', 'companies', 'user_settings'] as const) {
      const res = await db.query(`delete from public.${table}`)
      expect(res.affectedRows, table).toBe(EXPECTED_ROWS[table])
    }
    expect(await snapshot(db, USER_B, USER_A)).toEqual(before)
  })

  const foreignInserts: [string, Table, () => Record<string, unknown>, string][] = [
    ['companies', 'companies', () => ({ user_id: USER_B, name: 'X', color: '#000000' }), '42501'],
    ['user_settings', 'user_settings', () => ({ user_id: USER_B }), '42501'],
    // su folders, tasks e task_links il trigger di proprietà scatta prima della WITH CHECK della RLS
    [
      "folders nell'azienda di B",
      'folders',
      () => ({ user_id: USER_B, company_id: b.company, name: 'X' }),
      '23503',
    ],
    [
      "folders nell'azienda di A",
      'folders',
      () => ({ user_id: USER_B, company_id: a.company, name: 'X' }),
      '23503',
    ],
    [
      "tasks nell'azienda di B",
      'tasks',
      () => ({ user_id: USER_B, company_id: b.company, title: 'X', due_date: '2026-11-10' }),
      '23503',
    ],
    [
      "tasks nell'azienda di A",
      'tasks',
      () => ({ user_id: USER_B, company_id: a.company, title: 'X', due_date: '2026-11-10' }),
      '23503',
    ],
    [
      'task_links tra task di B',
      'task_links',
      () => ({ user_id: USER_B, parent_id: b.task2, child_id: b.task }),
      '23503',
    ],
    [
      'task_links tra task di A',
      'task_links',
      () => ({ user_id: USER_B, parent_id: a.task2, child_id: a.task }),
      '23503',
    ],
  ]

  it.each(foreignInserts)('INSERT con user_id di B rifiutato: %s', async (_label, table, values, code) => {
    const db = getDb()
    const before = await snapshot(db, USER_B, USER_A)
    await expectPgError(insert(db, table, values()), code)
    expect(await snapshot(db, USER_B, USER_A)).toEqual(before)
  })

  it.each([
    ['companies', 'id = $2', '42501'],
    ['user_settings', 'user_id = $2', '42501'],
    ['folders', 'id = $2', '23503'],
    ['tasks', 'id = $2', '23503'],
  ] as const)('%s: A non può cedere una propria riga a B cambiando user_id', async (table, where, code) => {
    const db = getDb()
    const key =
      table === 'companies' ? a.company : table === 'folders' ? a.folder : table === 'tasks' ? a.task : USER_A
    await expectPgError(
      db.query(`update public.${table} set user_id = $1 where ${where}`, [USER_B, key]),
      code,
    )
  })

  it('task_links: A non può cedere un proprio collegamento a B', async () => {
    const db = getDb()
    await expectPgError(
      db.query('update public.task_links set user_id = $1 where parent_id = $2', [USER_B, a.task]),
      '23503',
      /Task non trovata/,
    )
  })
})

describe('RLS: anon non vede e non scrive nulla', () => {
  beforeEach(async () => {
    await actAs(getDb(), null)
  })

  it.each(TABLES)('%s: SELECT come anon restituisce 0 righe', async (table) => {
    expect(await count(getDb(), `select 1 from public.${table}`)).toBe(0)
  })

  it('INSERT, UPDATE e DELETE come anon non hanno effetto', async () => {
    const db = getDb()
    const beforeA = await snapshot(db, USER_A, null)
    await expectPgError(insert(db, 'companies', { user_id: USER_A, name: 'X', color: '#000000' }), '42501')
    await expectPgError(insert(db, 'user_settings', { user_id: newId() }), '42501')
    for (const table of TABLES) {
      expect((await db.query(`update public.${table} set ${HARMLESS_SET[table]}`)).affectedRows, table).toBe(
        0,
      )
    }
    for (const table of TABLES) {
      expect((await db.query(`delete from public.${table}`)).affectedRows, table).toBe(0)
    }
    expect(await snapshot(db, USER_A, null)).toEqual(beforeA)
  })
})

describe('RLS: apply_changes non tocca le righe di un altro utente', () => {
  beforeEach(async () => {
    await actAs(getDb(), USER_A)
  })

  it("upsert con l'id di un'azienda di B: errore RLS e nessuna modifica", async () => {
    const db = getDb()
    const before = await snapshot(db, USER_B, USER_A)
    await expectPgError(
      applyChanges(db, [
        { op: 'upsert', table: 'companies', rows: [{ id: b.company, name: 'Rubata', color: '#000000' }] },
      ]),
      '42501',
      /row-level security/,
    )
    expect(await snapshot(db, USER_B, USER_A)).toEqual(before)
  })

  it("upsert con l'id di una cartella o task di B (puntando ad aziende di A): errore RLS", async () => {
    const db = getDb()
    const before = await snapshot(db, USER_B, USER_A)
    await expectPgError(
      applyChanges(db, [
        { op: 'upsert', table: 'folders', rows: [{ id: b.folder, company_id: a.company, name: 'Rubata' }] },
      ]),
      '42501',
    )
    await expectPgError(
      applyChanges(db, [
        {
          op: 'upsert',
          table: 'tasks',
          rows: [{ id: b.task, company_id: a.company, title: 'Rubata', due_date: '2026-11-10' }],
        },
      ]),
      '42501',
    )
    expect(await snapshot(db, USER_B, USER_A)).toEqual(before)
    // e non sono comparse righe nuove per A
    expect(await count(db, 'select 1 from public.folders')).toBe(1)
    expect(await count(db, 'select 1 from public.tasks')).toBe(2)
  })

  it('upsert di righe nuove agganciate ad aziende, cartelle o task di B: rifiutato dai trigger', async () => {
    const db = getDb()
    const before = await snapshot(db, USER_B, USER_A)
    await expectPgError(
      applyChanges(db, [
        { op: 'upsert', table: 'folders', rows: [{ id: newId(), company_id: b.company, name: 'X' }] },
      ]),
      '23503',
      /Azienda/,
    )
    await expectPgError(
      applyChanges(db, [
        {
          op: 'upsert',
          table: 'tasks',
          rows: [{ id: newId(), company_id: b.company, title: 'X', due_date: '2026-11-10' }],
        },
      ]),
      '23503',
      /Azienda/,
    )
    await expectPgError(
      applyChanges(db, [
        {
          op: 'upsert',
          table: 'tasks',
          rows: [
            { id: newId(), company_id: a.company, folder_id: b.folder, title: 'X', due_date: '2026-11-10' },
          ],
        },
      ]),
      '23503',
      /Cartella/,
    )
    await expectPgError(
      applyChanges(db, [
        { op: 'upsert', table: 'task_links', rows: [{ parent_id: b.task2, child_id: b.task }] },
      ]),
      '23503',
      /Task non trovata/,
    )
    await expectPgError(
      applyChanges(db, [
        { op: 'upsert', table: 'task_links', rows: [{ parent_id: a.task2, child_id: b.task }] },
      ]),
      '23503',
      /Task non trovata/,
    )
    expect(await snapshot(db, USER_B, USER_A)).toEqual(before)
  })

  it('patch sulle righe di B: ignorata in silenzio (la riga non è visibile)', async () => {
    const db = getDb()
    const before = await snapshot(db, USER_B, USER_A)
    await applyChanges(db, [
      { op: 'patch', table: 'companies', id: b.company, patch: { name: 'Rubata' } },
      { op: 'patch', table: 'folders', id: b.folder, patch: { name: 'Rubata' } },
      { op: 'patch', table: 'tasks', id: b.task, patch: { title: 'Rubata', status: 'done' } },
    ])
    expect(await snapshot(db, USER_B, USER_A)).toEqual(before)
  })

  it('delete sulle righe di B: nessun effetto', async () => {
    const db = getDb()
    const before = await snapshot(db, USER_B, USER_A)
    await applyChanges(db, [
      { op: 'delete', table: 'task_links', keys: [{ parent_id: b.task, child_id: b.task2 }] },
      { op: 'delete', table: 'tasks', ids: [b.task, b.task2] },
      { op: 'delete', table: 'folders', ids: [b.folder] },
      { op: 'delete', table: 'companies', ids: [b.company] },
    ])
    expect(await snapshot(db, USER_B, USER_A)).toEqual(before)
  })

  it('come anon la funzione non è eseguibile', async () => {
    const db = getDb()
    await actAs(db, null)
    await expectPgError(applyChanges(db, []), '42501', /permission denied for function apply_changes/)
  })

  it('come authenticated senza utente nel JWT solleva "Utente non autenticato"', async () => {
    const db = getDb()
    await actAsAuthenticatedWithoutUser(db)
    await expectPgError(
      applyChanges(db, [
        { op: 'upsert', table: 'companies', rows: [{ id: newId(), name: 'X', color: '#000000' }] },
      ]),
      '42501',
      /Utente non autenticato/,
    )
    expect(await countAll(db, 'companies')).toBe(2)
  })
})
