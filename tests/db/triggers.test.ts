// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { actAs, asSuperuser } from './harness'
import {
  USER_A,
  USER_B,
  applyChanges,
  company,
  count,
  countAll,
  expectPgError,
  folder,
  link,
  one,
  rows,
  task,
  freshDbPerTest,
} from './fixtures'

const getDb = freshDbPerTest()

describe('trigger di proprietà (check_owner, task_links_guard)', () => {
  let cA: string
  let cA2: string
  let fA: string
  let fA2: string
  let tA: string
  let cB: string
  let fB: string
  let tB: string

  beforeEach(async () => {
    const db = getDb()
    await actAs(db, USER_B)
    cB = await company(db)
    fB = await folder(db, cB)
    tB = await task(db, cB, { folder_id: fB })
    await actAs(db, USER_A)
    cA = await company(db, { name: 'Prima' })
    cA2 = await company(db, { name: 'Seconda' })
    fA = await folder(db, cA)
    fA2 = await folder(db, cA2)
    tA = await task(db, cA, { folder_id: fA })
  })

  it("cartella nell'azienda di un altro utente: rifiutata (insert e update)", async () => {
    const db = getDb()
    await expectPgError(folder(db, cB), '23503', /Azienda .* non trovata/)
    await expectPgError(
      db.query('update public.folders set company_id = $1 where id = $2', [cB, fA]),
      '23503',
    )
    expect(
      (await one<{ company_id: string }>(db, 'select company_id from public.folders where id = $1', [fA]))
        .company_id,
    ).toBe(cA)
  })

  it("task nell'azienda di un altro utente: rifiutata (insert e update)", async () => {
    const db = getDb()
    await expectPgError(task(db, cB), '23503', /Azienda .* non trovata/)
    await expectPgError(
      db.query('update public.tasks set company_id = $1, folder_id = null where id = $2', [cB, tA]),
      '23503',
      /Azienda/,
    )
  })

  it('task con la cartella di un altro utente: rifiutata', async () => {
    const db = getDb()
    await expectPgError(task(db, cA, { folder_id: fB }), '23503', /Cartella .* non valida/)
    await expectPgError(
      db.query('update public.tasks set folder_id = $1 where id = $2', [fB, tA]),
      '23503',
      /Cartella/,
    )
  })

  it("task con una cartella di un'altra azienda dello stesso utente: rifiutata", async () => {
    const db = getDb()
    await expectPgError(task(db, cA, { folder_id: fA2 }), '23503', /Cartella .* non valida per l'azienda/)
    // cambiare solo la cartella
    await expectPgError(db.query('update public.tasks set folder_id = $1 where id = $2', [fA2, tA]), '23503')
    // cambiare solo l'azienda lasciando la cartella della vecchia
    await expectPgError(db.query('update public.tasks set company_id = $1 where id = $2', [cA2, tA]), '23503')
    // azienda e cartella cambiate insieme in modo coerente: ok
    await db.query('update public.tasks set company_id = $1, folder_id = $2 where id = $3', [cA2, fA2, tA])
    const row = await one<{ company_id: string; folder_id: string }>(
      db,
      'select company_id, folder_id from public.tasks where id = $1',
      [tA],
    )
    expect(row).toEqual({ company_id: cA2, folder_id: fA2 })
  })

  it('collegamento verso o da una task di un altro utente: rifiutato (insert e update)', async () => {
    const db = getDb()
    await expectPgError(link(db, tA, tB), '23503', /Task non trovata/)
    await expectPgError(link(db, tB, tA), '23503', /Task non trovata/)
    const tA2 = await task(db, cA)
    await link(db, tA, tA2)
    await expectPgError(
      db.query('update public.task_links set child_id = $1 where parent_id = $2', [tB, tA]),
      '23503',
      /Task non trovata/,
    )
    expect(await countAll(db, 'task_links')).toBe(1)
  })

  it("eliminare un'azienda con cartelle piene di task (e collegamenti) riesce e porta via tutto", async () => {
    const db = getDb()
    const tInFolder = await task(db, cA, { folder_id: fA })
    const tNoFolder = await task(db, cA)
    const fA3 = await folder(db, cA, { name: 'Altra' })
    await task(db, cA, { folder_id: fA3 })
    await link(db, tA, tInFolder)
    await link(db, tInFolder, tNoFolder)
    // un collegamento verso una task di un'altra azienda che resta
    const tOther = await task(db, cA2, { folder_id: fA2 })
    await link(db, tOther, tA)

    const res = await db.query('delete from public.companies where id = $1', [cA])
    expect(res.affectedRows).toBe(1)

    expect(await count(db, 'select 1 from public.folders where company_id = $1', [cA])).toBe(0)
    expect(await count(db, 'select 1 from public.tasks where company_id = $1', [cA])).toBe(0)
    expect(await count(db, 'select 1 from public.task_links')).toBe(0)
    // l'altra azienda è intatta
    expect(
      await count(db, 'select 1 from public.tasks where id = $1 and folder_id = $2', [tOther, fA2]),
    ).toBe(1)
    // i dati di B pure
    expect(await countAll(db, 'tasks', 'user_id = $1', [USER_B])).toBe(1)
  })

  it('eliminare una cartella (cascade "set null") stacca le task senza farle fallire il controllo', async () => {
    const db = getDb()
    const t2 = await task(db, cA, { folder_id: fA })
    await db.query('delete from public.folders where id = $1', [fA])
    const res = await rows<{ id: string; folder_id: string | null; company_id: string }>(
      db,
      'select id, folder_id, company_id from public.tasks where id = any($1::uuid[]) order by id',
      [[tA, t2].sort()],
    )
    expect(res).toEqual([tA, t2].sort().map((id) => ({ id, folder_id: null, company_id: cA })))
  })

  it("spostare una cartella: prima la cartella e poi le task funziona, l'ordine inverso no", async () => {
    const db = getDb()
    // ordine usato da saveFolder: cartella, poi le sue task
    await applyChanges(db, [
      { op: 'patch', table: 'folders', id: fA, patch: { company_id: cA2 } },
      { op: 'patch', table: 'tasks', id: tA, patch: { company_id: cA2 } },
    ])
    expect(
      await one<{ company_id: string; folder_id: string }>(
        db,
        'select company_id, folder_id from public.tasks where id = $1',
        [tA],
      ),
    ).toEqual({ company_id: cA2, folder_id: fA })

    // ordine inverso (prima le task): la cartella è ancora nell'altra azienda, il trigger rifiuta
    // e il batch intero viene annullato
    await expectPgError(
      applyChanges(db, [
        { op: 'patch', table: 'tasks', id: tA, patch: { company_id: cA } },
        { op: 'patch', table: 'folders', id: fA, patch: { company_id: cA } },
      ]),
      '23503',
      /Cartella/,
    )
    expect(
      (await one<{ company_id: string }>(db, 'select company_id from public.folders where id = $1', [fA]))
        .company_id,
    ).toBe(cA2)
  })

  it('early return di check_owner: un update che non cambia azienda né cartella non rifà il controllo', async () => {
    const db = getDb()
    // spostando solo la cartella le sue task restano nella vecchia azienda (il trigger su folders
    // non guarda le task): stato incoerente ma possibile
    await db.query('update public.folders set company_id = $1 where id = $2', [cA2, fA])
    // apply_changes riscrive sempre company_id e folder_id, quindi il trigger scatta: senza
    // l'early return questa patch del solo titolo fallirebbe con "Cartella non valida"
    await applyChanges(db, [{ op: 'patch', table: 'tasks', id: tA, patch: { title: 'Rinominata' } }])
    expect(
      await one<{ title: string; company_id: string; folder_id: string }>(
        db,
        'select title, company_id, folder_id from public.tasks where id = $1',
        [tA],
      ),
    ).toEqual({ title: 'Rinominata', company_id: cA, folder_id: fA })
    // togliere la cartella è sempre permesso; cambiarla no
    await db.query('update public.tasks set folder_id = null where id = $1', [tA])
    await expectPgError(db.query('update public.tasks set folder_id = $1 where id = $2', [fA, tA]), '23503')
  })

  it("eliminare l'utente da auth.users elimina tutti i suoi dati", async () => {
    const db = getDb()
    const tA2 = await task(db, cA, { folder_id: fA })
    await link(db, tA, tA2)
    await asSuperuser(db)
    await db.query('insert into public.user_settings (user_id) values ($1)', [USER_A])
    await db.query('delete from auth.users where id = $1', [USER_A])
    for (const table of ['companies', 'folders', 'tasks', 'task_links', 'user_settings'] as const) {
      expect(await countAll(db, table, 'user_id = $1', [USER_A]), table).toBe(0)
    }
    expect(await countAll(db, 'tasks', 'user_id = $1', [USER_B])).toBe(1)
  })
})

describe('trigger completed_at e updated_at', () => {
  const EXPLICIT = '2026-01-02T03:04:05.000Z'
  let c: string

  beforeEach(async () => {
    const db = getDb()
    await actAs(db, USER_A)
    c = await company(db)
  })

  interface Times {
    status: string
    completed_at: Date | null
    updated_at: Date
  }
  const times = (id: string) =>
    one<Times>(getDb(), 'select status, completed_at, updated_at from public.tasks where id = $1', [id])
  const dbNow = async () => (await one<{ now: Date }>(getDb(), 'select now()')).now

  it('insert in "done" senza completed_at: lo imposta il server', async () => {
    const before = await dbNow()
    const id = await task(getDb(), c, { status: 'done' })
    const t = await times(id)
    expect(t.completed_at).not.toBeNull()
    expect(t.completed_at!.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })

  it('insert in uno stato diverso da "done": completed_at null anche se il client lo manda', async () => {
    const id1 = await task(getDb(), c, { status: 'todo' })
    const id2 = await task(getDb(), c, { status: 'doing', completed_at: EXPLICIT })
    expect((await times(id1)).completed_at).toBeNull()
    expect((await times(id2)).completed_at).toBeNull()
  })

  it('insert in "done" con completed_at esplicito (ripristino, backup): valore mantenuto', async () => {
    const id = await task(getDb(), c, { status: 'done', completed_at: EXPLICIT })
    expect((await times(id)).completed_at!.toISOString()).toBe(EXPLICIT)
  })

  it('update verso "done": completed_at impostato; uscendo da "done": azzerato', async () => {
    const db = getDb()
    const id = await task(db, c)
    expect((await times(id)).completed_at).toBeNull()
    const before = await dbNow()
    await db.query(`update public.tasks set status = 'done' where id = $1`, [id])
    const done = await times(id)
    expect(done.completed_at).not.toBeNull()
    expect(done.completed_at!.getTime()).toBeGreaterThanOrEqual(before.getTime())

    for (const status of ['review', 'doing', 'todo']) {
      await db.query(`update public.tasks set status = 'done', completed_at = $2 where id = $1`, [
        id,
        EXPLICIT,
      ])
      await db.query(`update public.tasks set status = $2 where id = $1`, [id, status])
      expect((await times(id)).completed_at, status).toBeNull()
    }
  })

  it('uscendo da "done" completed_at resta null anche se il client prova a mantenerlo', async () => {
    const db = getDb()
    const id = await task(db, c, { status: 'done', completed_at: EXPLICIT })
    await db.query(`update public.tasks set status = 'todo', completed_at = $2 where id = $1`, [id, EXPLICIT])
    expect((await times(id)).completed_at).toBeNull()
  })

  it('aggiornando altri campi di una task "done" completed_at non cambia', async () => {
    const db = getDb()
    const id = await task(db, c, { status: 'done', completed_at: EXPLICIT })
    await db.query(`update public.tasks set title = 'Rinominata', priority = 1, notes = 'x' where id = $1`, [
      id,
    ])
    await db.query(`update public.tasks set status = 'done' where id = $1`, [id])
    expect((await times(id)).completed_at!.toISOString()).toBe(EXPLICIT)
  })

  it('annulla: rimettere "done" con l\'orario originale lo conserva', async () => {
    const db = getDb()
    const id = await task(db, c, { status: 'done', completed_at: EXPLICIT })
    await db.query(`update public.tasks set status = 'todo' where id = $1`, [id])
    await db.query(`update public.tasks set status = 'done', completed_at = $2 where id = $1`, [id, EXPLICIT])
    expect((await times(id)).completed_at!.toISOString()).toBe(EXPLICIT)
  })

  it('una task "done" ha sempre completed_at: azzerarlo a mano lo reimposta a now()', async () => {
    const db = getDb()
    const id = await task(db, c, { status: 'done', completed_at: EXPLICIT })
    await db.query('update public.tasks set completed_at = null where id = $1', [id])
    const t = await times(id)
    expect(t.completed_at).not.toBeNull()
    expect(t.completed_at!.toISOString()).not.toBe(EXPLICIT)
  })

  it('updated_at cambia a ogni update e non è scrivibile dal client', async () => {
    const db = getDb()
    const old = '2020-01-01T00:00:00.000Z'
    const id = await task(db, c, { updated_at: old })
    expect((await times(id)).updated_at.toISOString()).toBe(old)

    const before = await dbNow()
    await db.query(`update public.tasks set notes = 'nuove note' where id = $1`, [id])
    const first = (await times(id)).updated_at
    expect(first.getTime()).toBeGreaterThanOrEqual(before.getTime())

    await db.query('update public.tasks set updated_at = $2 where id = $1', [id, old])
    expect((await times(id)).updated_at.getTime()).toBeGreaterThanOrEqual(first.getTime())
  })
})

describe('anti-ciclo su task_links', () => {
  let t1: string
  let t2: string
  let t3: string
  let t4: string

  beforeEach(async () => {
    const db = getDb()
    await actAs(db, USER_A)
    const c = await company(db)
    t1 = await task(db, c, { title: 'T1' })
    t2 = await task(db, c, { title: 'T2' })
    t3 = await task(db, c, { title: 'T3' })
    t4 = await task(db, c, { title: 'T4' })
  })

  const linkCount = () => count(getDb(), 'select 1 from public.task_links')

  it('auto-collegamento: rifiutato dal check constraint', async () => {
    const db = getDb()
    const err = await link(db, t1, t1).then(
      () => undefined,
      (e: unknown) => e,
    )
    expect(err).toMatchObject({ code: '23514', constraint: 'task_links_check' })
    expect(await linkCount()).toBe(0)
  })

  it('ciclo diretto A→B, B→A: rifiutato', async () => {
    const db = getDb()
    await link(db, t1, t2)
    await expectPgError(link(db, t2, t1), '23514', /creerebbe un ciclo/)
    expect(await linkCount()).toBe(1)
  })

  it('ciclo indiretto A→B, B→C, C→A: rifiutato', async () => {
    const db = getDb()
    await link(db, t1, t2)
    await link(db, t2, t3)
    await expectPgError(link(db, t3, t1), '23514', /creerebbe un ciclo/)
    await link(db, t3, t4)
    await expectPgError(link(db, t4, t1), '23514', /creerebbe un ciclo/)
    await expectPgError(link(db, t4, t2), '23514', /creerebbe un ciclo/)
    expect(await linkCount()).toBe(3)
  })

  it('diamante A→B, A→C, B→D, C→D: accettato (non è un ciclo), ma D→A no', async () => {
    const db = getDb()
    await link(db, t1, t2)
    await link(db, t1, t3)
    await link(db, t2, t4)
    await link(db, t3, t4)
    // scorciatoia sul DAG: ancora aciclico
    await link(db, t1, t4)
    expect(await linkCount()).toBe(5)
    await expectPgError(link(db, t4, t1), '23514', /creerebbe un ciclo/)
    await expectPgError(link(db, t4, t3), '23514', /creerebbe un ciclo/)
  })

  it('ciclo creato da più righe nello stesso INSERT: rifiutato', async () => {
    const db = getDb()
    await expectPgError(
      db.query('insert into public.task_links (parent_id, child_id) values ($1, $2), ($2, $3), ($3, $1)', [
        t1,
        t2,
        t3,
      ]),
      '23514',
      /creerebbe un ciclo/,
    )
    expect(await linkCount()).toBe(0)
  })

  it('ciclo creato in un batch di apply_changes: rifiutato e annullato per intero', async () => {
    const db = getDb()
    await expectPgError(
      applyChanges(db, [
        { op: 'upsert', table: 'task_links', rows: [{ parent_id: t1, child_id: t2 }] },
        { op: 'upsert', table: 'task_links', rows: [{ parent_id: t2, child_id: t1 }] },
      ]),
      '23514',
    )
    expect(await linkCount()).toBe(0)
  })

  it('i collegamenti di un altro utente non influenzano il controllo', async () => {
    const db = getDb()
    await link(db, t1, t2)
    await actAs(db, USER_B)
    const cB = await company(db)
    const b1 = await task(db, cB)
    const b2 = await task(db, cB)
    await link(db, b1, b2)
    await link(db, b2, await task(db, cB))
    expect(await count(db, 'select 1 from public.task_links')).toBe(2)
  })
})
