// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { actAs, asSuperuser } from './harness'
import {
  USER_A,
  USER_B,
  applyChanges,
  company,
  count,
  expectPgError,
  freshDbPerTest,
  newId,
  one,
  rows,
} from './fixtures'

const getDb = freshDbPerTest()

const brand = {
  colors: [{ id: 'c1', name: 'Giallo', hex: '#ffe08a', role: 'primary' }],
  fonts: [{ id: 'f1', family: 'Lato', role: 'body', files: [] }],
  logos: [
    {
      id: 'l1',
      label: 'Logo',
      file: { path: `${USER_A}/x/1.svg`, name: 'logo.svg', mime: 'image/svg+xml', size: 10 },
      bg: 'light',
    },
  ],
  payoff: 'Fatto bene',
}

const brandOf = async (id: string) =>
  (await one<{ brand: unknown }>(getDb(), 'select brand from public.companies where id = $1', [id])).brand

describe('companies.brand', () => {
  beforeEach(async () => {
    await actAs(getDb(), USER_A)
  })

  it('default oggetto vuoto; deve essere un oggetto', async () => {
    const db = getDb()
    const id = await company(db)
    expect(await brandOf(id)).toEqual({})
    await expectPgError(db.query(`update public.companies set brand = '[]' where id = $1`, [id]), '23514')
  })

  it('apply_changes: upsert salva il setup, l’update lo sostituisce', async () => {
    const db = getDb()
    const id = newId()
    await applyChanges(db, [
      { op: 'upsert', table: 'companies', rows: [{ id, name: 'Acme', color: '#112233', brand }] },
    ])
    expect(await brandOf(id)).toEqual(brand)
    await applyChanges(db, [
      {
        op: 'upsert',
        table: 'companies',
        rows: [{ id, name: 'Acme', color: '#112233', brand: { payoff: 'Nuovo' } }],
      },
    ])
    expect(await brandOf(id)).toEqual({ payoff: 'Nuovo' })
  })

  it('apply_changes: patch del setup non tocca la scheda, e viceversa', async () => {
    const db = getDb()
    const id = await company(db, { profile: JSON.stringify({ vat: '123' }) })
    await applyChanges(db, [{ op: 'patch', table: 'companies', id, patch: { brand } }])
    expect(await brandOf(id)).toEqual(brand)
    await applyChanges(db, [{ op: 'patch', table: 'companies', id, patch: { profile: { vat: '456' } } }])
    const row = await one<{ brand: unknown; profile: unknown }>(
      db,
      'select brand, profile from public.companies where id = $1',
      [id],
    )
    expect(row).toEqual({ brand, profile: { vat: '456' } })
  })

  it('apply_changes: un setup non oggetto fa fallire tutto il batch', async () => {
    const db = getDb()
    const id = await company(db, { name: 'Prima' })
    await expectPgError(
      applyChanges(db, [
        { op: 'patch', table: 'companies', id, patch: { name: 'Dopo' } },
        { op: 'patch', table: 'companies', id, patch: { brand: ['no'] } },
      ]),
      '23514',
    )
    const row = await one<{ name: string }>(db, 'select name from public.companies where id = $1', [id])
    expect(row.name).toBe('Prima')
  })
})

describe('storage: bucket brand', () => {
  const put = (name: string) =>
    getDb().query(`insert into storage.objects (bucket_id, name) values ('brand', $1)`, [name])

  it('il bucket esiste ed è privato', async () => {
    const db = getDb()
    await asSuperuser(db)
    const b = await one<{ public: boolean; file_size_limit: string }>(
      db,
      `select public, file_size_limit::text from storage.buckets where id = 'brand'`,
    )
    expect(b).toEqual({ public: false, file_size_limit: String(25 * 1024 * 1024) })
  })

  it('ognuno carica solo nella propria cartella', async () => {
    const db = getDb()
    await actAs(db, USER_A)
    await put(`${USER_A}/c1/logo.svg`)
    await expectPgError(put(`${USER_B}/c1/logo.svg`), '42501')
    await expectPgError(put('logo.svg'), '42501')
    await actAs(db, null)
    await expectPgError(put(`${USER_A}/c1/anon.svg`), '42501')
  })

  it('lettura, modifica ed eliminazione solo dei propri file', async () => {
    const db = getDb()
    await actAs(db, USER_A)
    await put(`${USER_A}/c1/a.svg`)
    await actAs(db, USER_B)
    await put(`${USER_B}/c2/b.svg`)

    const names = async () =>
      (await rows<{ name: string }>(db, 'select name from storage.objects order by name')).map((r) => r.name)
    expect(await names()).toEqual([`${USER_B}/c2/b.svg`])

    // B non vede, non rinomina e non elimina i file di A
    await db.query(`update storage.objects set name = $1 where name = $2`, [
      `${USER_B}/rubato.svg`,
      `${USER_A}/c1/a.svg`,
    ])
    await db.query(`delete from storage.objects where name like $1`, [`${USER_A}/%`])
    await actAs(db, USER_A)
    expect(await names()).toEqual([`${USER_A}/c1/a.svg`])

    // A non può spostare un proprio file nella cartella di B
    await expectPgError(
      db.query(`update storage.objects set name = $1 where name = $2`, [
        `${USER_B}/c1/a.svg`,
        `${USER_A}/c1/a.svg`,
      ]),
      '42501',
    )
    await db.query(`delete from storage.objects where name = $1`, [`${USER_A}/c1/a.svg`])
    expect(await count(db, 'select 1 from storage.objects')).toBe(0)
  })
})
