// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { actAs } from './harness'
import {
  USER_A,
  USER_B,
  applyChanges,
  company,
  count,
  expectPgError,
  folder,
  link,
  newId,
  one,
  rows,
  task,
  freshDbPerTest,
} from './fixtures'

const getDb = freshDbPerTest()

type Json = Record<string, unknown>

/** Riga completa come jsonb (senza updated_at, che cambia a ogni update). */
async function rowOf(table: 'companies' | 'folders' | 'tasks', id: string): Promise<Json> {
  const r = await one<{ r: Json }>(
    getDb(),
    `select to_jsonb(x) - 'updated_at' as r from public.${table} x where id = $1`,
    [id],
  )
  return r.r
}

const linksOf = async () =>
  (
    await rows<{ parent_id: string; child_id: string }>(
      getDb(),
      'select parent_id, child_id from public.task_links order by parent_id, child_id',
    )
  ).map((l) => `${l.parent_id}>${l.child_id}`)

const pair = (p: string, c: string) => `${p}>${c}`

let c: string

beforeEach(async () => {
  const db = getDb()
  await actAs(db, USER_A)
  c = await company(db, { name: 'Base' })
})

describe('apply_changes: upsert', () => {
  it('companies: insert con default, poi update; created_at non cambia', async () => {
    const db = getDb()
    const id = newId()
    await applyChanges(db, [
      { op: 'upsert', table: 'companies', rows: [{ id, name: 'Acme', color: '#112233' }] },
    ])
    const inserted = await rowOf('companies', id)
    expect(inserted).toMatchObject({
      id,
      user_id: USER_A,
      name: 'Acme',
      color: '#112233',
      position: 0,
      profile: {},
    })
    expect(inserted.created_at).toEqual(expect.any(String))

    await applyChanges(db, [
      {
        op: 'upsert',
        table: 'companies',
        rows: [
          {
            id,
            name: 'Acme Srl',
            color: '#445566',
            position: 4,
            profile: { piva: '123' },
            created_at: '2030-01-01T00:00:00Z',
          },
        ],
      },
    ])
    expect(await rowOf('companies', id)).toEqual({
      ...inserted,
      name: 'Acme Srl',
      color: '#445566',
      position: 4,
      profile: { piva: '123' },
    })
    expect(await count(db, 'select 1 from public.companies where id = $1', [id])).toBe(1)
  })

  it("folders: insert e update (anche spostamento in un'altra azienda)", async () => {
    const db = getDb()
    const c2 = await company(db, { name: 'Altra' })
    const id = newId()
    await applyChanges(db, [
      { op: 'upsert', table: 'folders', rows: [{ id, company_id: c, name: 'Contratti' }] },
    ])
    expect(await rowOf('folders', id)).toMatchObject({
      id,
      user_id: USER_A,
      company_id: c,
      name: 'Contratti',
      position: 0,
    })

    await applyChanges(db, [
      { op: 'upsert', table: 'folders', rows: [{ id, company_id: c2, name: 'Contratti 2026', position: 2 }] },
    ])
    expect(await rowOf('folders', id)).toMatchObject({ company_id: c2, name: 'Contratti 2026', position: 2 })
  })

  it('tasks: campi omessi prendono i default (notes, link, priority 3, status todo, checklist [])', async () => {
    const db = getDb()
    const id = newId()
    await applyChanges(db, [
      {
        op: 'upsert',
        table: 'tasks',
        rows: [{ id, company_id: c, title: 'Minima', due_date: '2026-11-10' }],
      },
    ])
    expect(await rowOf('tasks', id)).toMatchObject({
      id,
      user_id: USER_A,
      company_id: c,
      folder_id: null,
      title: 'Minima',
      notes: '',
      link: '',
      priority: 3,
      status: 'todo',
      due_date: '2026-11-10',
      due_time: null,
      estimate_min: 0,
      checklist: [],
      completed_at: null,
    })
  })

  it('tasks: update della riga completa e updated_at aggiornato', async () => {
    const db = getDb()
    const f = await folder(db, c)
    const id = newId()
    await applyChanges(db, [
      {
        op: 'upsert',
        table: 'tasks',
        rows: [{ id, company_id: c, title: 'Prima', due_date: '2026-11-10' }],
      },
    ])
    await db.query(`update public.tasks set updated_at = '2020-01-01' where id = $1`, [id])
    const full = {
      id,
      company_id: c,
      folder_id: f,
      title: 'Dopo',
      notes: 'note',
      link: 'https://example.com',
      priority: 1,
      status: 'review',
      due_date: '2026-12-01',
      due_time: '09:30:00',
      estimate_min: 45,
      checklist: [{ id: 'x', text: 'passo', done: true }],
      completed_at: null,
    }
    await applyChanges(db, [{ op: 'upsert', table: 'tasks', rows: [full] }])
    expect(await rowOf('tasks', id)).toMatchObject(full)
    const u = await one<{ fresh: boolean }>(
      db,
      `select updated_at > '2020-01-02' as fresh from public.tasks where id = $1`,
      [id],
    )
    expect(u.fresh).toBe(true)
  })

  it('created_at fornito dal client viene mantenuto (companies, folders, tasks)', async () => {
    const db = getDb()
    const created = '2025-05-05T10:00:00+00:00'
    const ids = { companies: newId(), folders: newId(), tasks: newId() }
    await applyChanges(db, [
      {
        op: 'upsert',
        table: 'companies',
        rows: [{ id: ids.companies, name: 'Vecchia', color: '#000000', created_at: created }],
      },
      {
        op: 'upsert',
        table: 'folders',
        rows: [{ id: ids.folders, company_id: ids.companies, name: 'F', created_at: created }],
      },
      {
        op: 'upsert',
        table: 'tasks',
        rows: [
          {
            id: ids.tasks,
            company_id: ids.companies,
            title: 'T',
            due_date: '2026-11-10',
            created_at: created,
          },
        ],
      },
    ])
    for (const [table, id] of Object.entries(ids) as [keyof typeof ids, string][]) {
      expect((await rowOf(table, id)).created_at, table).toBe(created)
    }
  })

  it('user_id nel payload viene ignorato: sempre quello del chiamante (insert e update)', async () => {
    const db = getDb()
    const cid = newId()
    const tid = newId()
    await applyChanges(db, [
      { op: 'upsert', table: 'companies', rows: [{ id: cid, user_id: USER_B, name: 'X', color: '#000000' }] },
      {
        op: 'upsert',
        table: 'tasks',
        rows: [{ id: tid, user_id: USER_B, company_id: cid, title: 'T', due_date: '2026-11-10' }],
      },
      { op: 'upsert', table: 'companies', rows: [{ id: cid, user_id: USER_B, name: 'Y', color: '#000000' }] },
    ])
    expect((await rowOf('companies', cid)).user_id).toBe(USER_A)
    expect((await rowOf('tasks', tid)).user_id).toBe(USER_A)
    expect((await rowOf('companies', cid)).name).toBe('Y')
  })

  it('completed_at: valore esplicito mantenuto; riga "done" senza completed_at viene ritimbrata', async () => {
    const db = getDb()
    const id = newId()
    const at = '2026-03-04T05:06:07+00:00'
    const row = { id, company_id: c, title: 'T', due_date: '2026-11-10', status: 'done', completed_at: at }
    await applyChanges(db, [{ op: 'upsert', table: 'tasks', rows: [row] }])
    expect((await rowOf('tasks', id)).completed_at).toBe(at)
    // stessa riga reinviata (coda offline): invariata
    await applyChanges(db, [{ op: 'upsert', table: 'tasks', rows: [row] }])
    expect((await rowOf('tasks', id)).completed_at).toBe(at)
    // comportamento attuale: se il client omette completed_at su una task già "done",
    // il trigger lo reimposta a now() (l'upsert sovrascrive con excluded.completed_at)
    await applyChanges(db, [{ op: 'upsert', table: 'tasks', rows: [{ ...row, completed_at: undefined }] }])
    const after = (await rowOf('tasks', id)).completed_at
    expect(after).not.toBeNull()
    expect(after).not.toBe(at)
  })

  it('batch ordinato: azienda, cartella, task e collegamento creati nello stesso batch', async () => {
    const db = getDb()
    const ids = { c: newId(), f: newId(), t1: newId(), t2: newId() }
    const batch = [
      { op: 'upsert', table: 'companies', rows: [{ id: ids.c, name: 'Nuova', color: '#abcdef' }] },
      { op: 'upsert', table: 'folders', rows: [{ id: ids.f, company_id: ids.c, name: 'F' }] },
      {
        op: 'upsert',
        table: 'tasks',
        rows: [
          { id: ids.t1, company_id: ids.c, folder_id: ids.f, title: 'Padre', due_date: '2026-11-10' },
          { id: ids.t2, company_id: ids.c, title: 'Figlio', due_date: '2026-11-11' },
        ],
      },
      { op: 'upsert', table: 'task_links', rows: [{ parent_id: ids.t1, child_id: ids.t2 }] },
    ]
    await applyChanges(db, batch)
    // idempotente: rieseguire lo stesso batch (retry dopo errore di rete) non crea duplicati
    await applyChanges(db, batch)
    expect(await count(db, 'select 1 from public.companies where id = $1', [ids.c])).toBe(1)
    expect(await count(db, 'select 1 from public.folders where company_id = $1', [ids.c])).toBe(1)
    expect(await count(db, 'select 1 from public.tasks where company_id = $1', [ids.c])).toBe(2)
    expect(await linksOf()).toEqual([pair(ids.t1, ids.t2)])
  })

  it('task_links: upsert idempotente (ripetuto e con righe duplicate)', async () => {
    const db = getDb()
    const t1 = await task(db, c)
    const t2 = await task(db, c)
    const up = { op: 'upsert', table: 'task_links', rows: [{ parent_id: t1, child_id: t2 }] }
    await applyChanges(db, [up])
    await applyChanges(db, [up, up])
    await applyChanges(db, [
      {
        op: 'upsert',
        table: 'task_links',
        rows: [
          { parent_id: t1, child_id: t2 },
          { parent_id: t1, child_id: t2 },
        ],
      },
    ])
    expect(await linksOf()).toEqual([pair(t1, t2)])
    const owner = await one<{ user_id: string }>(db, 'select user_id from public.task_links')
    expect(owner.user_id).toBe(USER_A)
  })
})

describe('apply_changes: patch', () => {
  let f: string
  let t: string

  beforeEach(async () => {
    const db = getDb()
    f = await folder(db, c)
    t = await task(db, c, {
      folder_id: f,
      title: 'Originale',
      notes: 'note',
      link: 'https://example.com',
      priority: 2,
      status: 'doing',
      due_date: '2026-11-20',
      due_time: '10:00',
      estimate_min: 30,
      checklist: JSON.stringify([{ id: 'a', text: 'uno', done: false }]),
    })
  })

  it('cambia solo le chiavi presenti nella patch', async () => {
    const db = getDb()
    const before = await rowOf('tasks', t)
    await applyChanges(db, [
      { op: 'patch', table: 'tasks', id: t, patch: { title: 'Nuovo titolo', priority: 5 } },
    ])
    expect(await rowOf('tasks', t)).toEqual({ ...before, title: 'Nuovo titolo', priority: 5 })
  })

  it('un valore null esplicito azzera il campo (folder_id, due_time)', async () => {
    const db = getDb()
    const before = await rowOf('tasks', t)
    await applyChanges(db, [
      { op: 'patch', table: 'tasks', id: t, patch: { folder_id: null, due_time: null } },
    ])
    expect(await rowOf('tasks', t)).toEqual({ ...before, folder_id: null, due_time: null })
  })

  it('status: "done" imposta completed_at, tornare indietro lo azzera, il valore esplicito resta', async () => {
    const db = getDb()
    await applyChanges(db, [{ op: 'patch', table: 'tasks', id: t, patch: { status: 'done' } }])
    expect((await rowOf('tasks', t)).completed_at).not.toBeNull()
    await applyChanges(db, [{ op: 'patch', table: 'tasks', id: t, patch: { status: 'todo' } }])
    expect((await rowOf('tasks', t)).completed_at).toBeNull()
    const at = '2026-02-03T04:05:06+00:00'
    await applyChanges(db, [
      { op: 'patch', table: 'tasks', id: t, patch: { status: 'done', completed_at: at } },
    ])
    expect((await rowOf('tasks', t)).completed_at).toBe(at)
  })

  it('companies e folders: patch parziale', async () => {
    const db = getDb()
    const companyBefore = await rowOf('companies', c)
    const folderBefore = await rowOf('folders', f)
    await applyChanges(db, [
      { op: 'patch', table: 'companies', id: c, patch: { profile: { referente: 'Mario' } } },
      { op: 'patch', table: 'folders', id: f, patch: { name: 'Rinominata' } },
    ])
    expect(await rowOf('companies', c)).toEqual({ ...companyBefore, profile: { referente: 'Mario' } })
    expect(await rowOf('folders', f)).toEqual({ ...folderBefore, name: 'Rinominata' })
  })

  it('patch su un id inesistente: ignorata senza errori', async () => {
    const db = getDb()
    const ghost = newId()
    await applyChanges(db, [
      { op: 'patch', table: 'companies', id: ghost, patch: { name: 'X' } },
      { op: 'patch', table: 'folders', id: ghost, patch: { name: 'X' } },
      { op: 'patch', table: 'tasks', id: ghost, patch: { title: 'X' } },
    ])
    expect(await count(db, 'select 1 from public.companies')).toBe(1)
    expect(await count(db, 'select 1 from public.folders')).toBe(1)
    expect(await count(db, 'select 1 from public.tasks')).toBe(1)
  })

  it('user_id, created_at e chiavi sconosciute nella patch sono ignorati', async () => {
    const db = getDb()
    const before = await rowOf('tasks', t)
    await applyChanges(db, [
      {
        op: 'patch',
        table: 'tasks',
        id: t,
        patch: { user_id: USER_B, created_at: '2000-01-01T00:00:00Z', non_esiste: 1, title: 'Ok' },
      },
    ])
    expect(await rowOf('tasks', t)).toEqual({ ...before, title: 'Ok' })
  })

  it('un "id" dentro la patch non sposta la modifica su un\'altra riga', async () => {
    const db = getDb()
    const other = await company(db, { name: 'Altra', color: '#ffffff' })
    const otherTask = await task(db, c, { title: 'Altra task' })
    const otherBefore = await rowOf('companies', other)
    const otherTaskBefore = await rowOf('tasks', otherTask)
    const cBefore = await rowOf('companies', c)
    await applyChanges(db, [
      { op: 'patch', table: 'companies', id: c, patch: { id: other, name: 'Patchata' } },
      { op: 'patch', table: 'tasks', id: t, patch: { id: otherTask, title: 'Patchata' } },
      { op: 'patch', table: 'folders', id: f, patch: { id: newId(), name: 'Patchata' } },
    ])
    expect(await rowOf('companies', other)).toEqual(otherBefore)
    expect(await rowOf('tasks', otherTask)).toEqual(otherTaskBefore)
    expect(await rowOf('companies', c)).toEqual({ ...cBefore, name: 'Patchata' })
    expect((await rowOf('tasks', t)).title).toBe('Patchata')
    expect((await rowOf('folders', f)).name).toBe('Patchata')
  })
})

describe('apply_changes: delete', () => {
  it('companies: cascade su cartelle, task e collegamenti', async () => {
    const db = getDb()
    const keep = await company(db, { name: 'Resta' })
    const kt = await task(db, keep)
    const f = await folder(db, c)
    const t1 = await task(db, c, { folder_id: f })
    const t2 = await task(db, c)
    await link(db, t1, t2)
    await link(db, kt, t1)
    await applyChanges(db, [{ op: 'delete', table: 'companies', ids: [c] }])
    expect(await count(db, 'select 1 from public.companies')).toBe(1)
    expect(await count(db, 'select 1 from public.folders')).toBe(0)
    expect(await rows<{ id: string }>(db, 'select id from public.tasks')).toEqual([{ id: kt }])
    expect(await linksOf()).toEqual([])
  })

  it('folders: le task restano con folder_id null', async () => {
    const db = getDb()
    const f = await folder(db, c)
    const f2 = await folder(db, c, { name: 'Resta' })
    const t1 = await task(db, c, { folder_id: f })
    const t2 = await task(db, c, { folder_id: f2 })
    await applyChanges(db, [{ op: 'delete', table: 'folders', ids: [f] }])
    expect((await rowOf('tasks', t1)).folder_id).toBeNull()
    expect((await rowOf('tasks', t2)).folder_id).toBe(f2)
    expect(await count(db, 'select 1 from public.folders')).toBe(1)
  })

  it('tasks: rimuove i collegamenti in cui compaiono (come padre o figlio)', async () => {
    const db = getDb()
    const [t1, t2, t3, t4] = [await task(db, c), await task(db, c), await task(db, c), await task(db, c)]
    await link(db, t1, t2)
    await link(db, t2, t3)
    await link(db, t1, t4)
    await applyChanges(db, [{ op: 'delete', table: 'tasks', ids: [t2] }])
    expect(await linksOf()).toEqual([pair(t1, t4)])
    expect(await count(db, 'select 1 from public.tasks')).toBe(3)
  })

  it('task_links: delete per chiave rimuove solo i collegamenti indicati', async () => {
    const db = getDb()
    const [t1, t2, t3] = [await task(db, c), await task(db, c), await task(db, c)]
    await link(db, t1, t2)
    await link(db, t1, t3)
    await link(db, t2, t3)
    await applyChanges(db, [
      {
        op: 'delete',
        table: 'task_links',
        keys: [
          { parent_id: t1, child_id: t3 },
          { parent_id: t3, child_id: t1 }, // inesistente: ignorato
        ],
      },
    ])
    expect((await linksOf()).sort()).toEqual([pair(t1, t2), pair(t2, t3)].sort())
  })

  it('id inesistenti o lista vuota: nessun errore', async () => {
    const db = getDb()
    await applyChanges(db, [
      { op: 'delete', table: 'tasks', ids: [newId()] },
      { op: 'delete', table: 'companies', ids: [] },
      { op: 'delete', table: 'task_links', keys: [] },
    ])
    expect(await count(db, 'select 1 from public.companies')).toBe(1)
  })
})

describe('apply_changes: errori e atomicità', () => {
  it.each([
    ['op sconosciuta', [{ op: 'merge', table: 'tasks', rows: [] }]],
    ['tabella sconosciuta', [{ op: 'upsert', table: 'users', rows: [] }]],
    ['tabella non gestita (user_settings)', [{ op: 'delete', table: 'user_settings', ids: [] }]],
    [
      'patch su task_links',
      [{ op: 'patch', table: 'task_links', id: '00000000-0000-4000-8000-000000000000', patch: {} }],
    ],
    ['op mancante', [{ table: 'tasks', rows: [] }]],
  ])('%s: errore 22023', async (_label, changes) => {
    await expectPgError(applyChanges(getDb(), changes), '22023', /Operazione non supportata/)
  })

  it('changes non è un array: errore 22023', async () => {
    await expectPgError(applyChanges(getDb(), { op: 'upsert' }), '22023', /deve essere un array/)
  })

  it('array vuoto: nessun effetto', async () => {
    await applyChanges(getDb(), [])
    expect(await count(getDb(), 'select 1 from public.companies')).toBe(1)
  })

  it.each([
    [
      'check constraint',
      {
        op: 'upsert',
        table: 'tasks',
        rows: [{ id: newId(), company_id: 'C', title: 'X', due_date: '2026-11-10', priority: 9 }],
      },
      '23514',
    ],
    ['op non supportata', { op: 'truncate', table: 'tasks' }, '22023'],
    [
      'azienda inesistente',
      { op: 'upsert', table: 'folders', rows: [{ id: newId(), company_id: newId(), name: 'X' }] },
      '23503',
    ],
  ] as const)(
    'se un elemento successivo fallisce (%s) i precedenti vengono annullati',
    async (_label, failing, code) => {
      const db = getDb()
      const f = await folder(db, c)
      const t = await task(db, c, { folder_id: f, title: 'Intatta' })
      const before = {
        companies: await rows(db, 'select * from public.companies order by id'),
        folders: await rows(db, 'select * from public.folders order by id'),
        tasks: await rows(db, 'select * from public.tasks order by id'),
      }
      const newCompany = newId()
      const resolved = JSON.parse(JSON.stringify(failing).replaceAll('"C"', JSON.stringify(c))) as unknown
      await expectPgError(
        applyChanges(db, [
          { op: 'upsert', table: 'companies', rows: [{ id: newCompany, name: 'Nuova', color: '#000000' }] },
          { op: 'patch', table: 'tasks', id: t, patch: { title: 'Modificata', status: 'done' } },
          { op: 'patch', table: 'companies', id: c, patch: { name: 'Modificata' } },
          { op: 'delete', table: 'folders', ids: [f] },
          resolved,
        ]),
        code,
      )
      expect({
        companies: await rows(db, 'select * from public.companies order by id'),
        folders: await rows(db, 'select * from public.folders order by id'),
        tasks: await rows(db, 'select * from public.tasks order by id'),
      }).toEqual(before)
    },
  )
})
