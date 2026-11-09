// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { applyChanges as applyLocal } from '@/data/changes'
import { snapshotToChanges } from '@/features/settings/snapshotChanges'
import { folderSaveChanges } from '@/features/companies/folderChanges'
import { buildSeed } from '@/lib/seed'
import { actAs } from './harness'
import { USER_A, applyChanges, count, expectPgError, freshDbPerTest, newId, one } from './fixtures'

/**
 * I batch prodotti dal client (e i loro inversi, usati da rollback e "Annulla") devono essere
 * accettati da Postgres così come sono: qui si mandano alla RPC apply_changes.
 */
const getDb = freshDbPerTest()

describe('batch del client su Postgres', () => {
  it('seed degli esempi, eliminazione di un’azienda e annulla', async () => {
    const db = getDb()
    await actAs(db, USER_A)
    const seed = buildSeed('2026-11-06', new Date('2026-11-06T10:00:00Z'))
    await applyChanges(db, snapshotToChanges(seed))
    expect(await count(db, 'select 1 from public.tasks')).toBe(14)
    expect(await count(db, 'select 1 from public.task_links')).toBe(3)

    const belelli = seed.companies.find((c) => c.name === 'Belelli')!
    const del = applyLocal(seed, [{ op: 'delete', table: 'companies', ids: [belelli.id] }])
    await applyChanges(db, [{ op: 'delete', table: 'companies', ids: [belelli.id] }])
    expect(await count(db, 'select 1 from public.tasks')).toBe(8)
    expect(await count(db, 'select 1 from public.task_links')).toBe(0)

    await applyChanges(db, del.inverse)
    expect(await count(db, 'select 1 from public.tasks')).toBe(14)
    expect(await count(db, 'select 1 from public.task_links')).toBe(3)
    const meet = await one<{ completed_at: string | null }>(
      db,
      "select completed_at from public.tasks where title = 'Inviare invito Google Meet'",
    )
    expect(new Date(meet.completed_at!).toISOString()).toBe(
      seed.tasks.find((t) => t.title === 'Inviare invito Google Meet')!.completed_at,
    )
  })

  it("spostamento di una cartella in un'altra azienda e il suo inverso", async () => {
    const db = getDb()
    await actAs(db, USER_A)
    const seed = buildSeed('2026-11-06', new Date('2026-11-06T10:00:00Z'))
    await applyChanges(db, snapshotToChanges(seed))

    const social = seed.folders.find((f) => f.name === 'Social novembre')!
    const hybrix = seed.companies.find((c) => c.name === 'Hybrix')!
    const changes = folderSaveChanges(social, seed.tasks, social.name, hybrix.id)
    const forward = applyLocal(seed, changes, { strict: true })

    await applyChanges(db, changes)
    expect(
      await count(db, 'select 1 from public.tasks where folder_id = $1 and company_id = $2', [
        social.id,
        hybrix.id,
      ]),
    ).toBe(2)

    await applyChanges(db, forward.inverse)
    expect(
      await count(db, 'select 1 from public.tasks where folder_id = $1 and company_id = $2', [
        social.id,
        social.company_id,
      ]),
    ).toBe(2)
    expect(
      await count(db, 'select 1 from public.folders where id = $1 and company_id = $2', [
        social.id,
        social.company_id,
      ]),
    ).toBe(1)
  })

  it("righe create in modo ottimistico con user_id vuoto: il server assegna l'utente", async () => {
    const db = getDb()
    await actAs(db, USER_A)
    const id = newId()
    await applyChanges(db, [
      { op: 'upsert', table: 'companies', rows: [{ id, user_id: '', name: 'Nuova', color: '#12b76a' }] },
      { op: 'patch', table: 'companies', id, patch: { user_id: '', name: 'Rinominata' } },
    ])
    const row = await one<{ user_id: string; name: string }>(
      db,
      'select user_id, name from public.companies where id = $1',
      [id],
    )
    expect(row).toEqual({ user_id: USER_A, name: 'Rinominata' })
  })

  it('upsert con rows non array: errore 22023', async () => {
    const db = getDb()
    await actAs(db, USER_A)
    await expectPgError(
      applyChanges(db, [{ op: 'upsert', table: 'tasks', rows: {} }]),
      '22023',
      /rows deve essere un array/,
    )
  })
})
