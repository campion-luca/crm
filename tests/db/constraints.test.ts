// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { actAs, asSuperuser } from './harness'
import { USER_A, company, expectPgError, insert, one, rows, task, freshDbPerTest } from './fixtures'

const getDb = freshDbPerTest()

describe('check constraint', () => {
  let c: string

  beforeEach(async () => {
    const db = getDb()
    await actAs(db, USER_A)
    c = await company(db)
  })

  it.each([0, 6, -1])('tasks.priority = %i: rifiutata', async (priority) => {
    await expectPgError(task(getDb(), c, { priority }), '23514', /tasks_priority_check/)
  })

  it.each([1, 3, 5])('tasks.priority = %i: accettata', async (priority) => {
    const id = await task(getDb(), c, { priority })
    expect(
      (await one<{ priority: number }>(getDb(), 'select priority from public.tasks where id = $1', [id]))
        .priority,
    ).toBe(priority)
  })

  it('tasks.title: vuoto o oltre 300 caratteri rifiutato, 1 e 300 accettati', async () => {
    const db = getDb()
    await expectPgError(task(db, c, { title: '' }), '23514', /tasks_title_check/)
    await expectPgError(task(db, c, { title: 'x'.repeat(301) }), '23514', /tasks_title_check/)
    await task(db, c, { title: 'x' })
    await task(db, c, { title: 'x'.repeat(300) })
    // anche in update
    const id = await task(db, c)
    await expectPgError(db.query(`update public.tasks set title = '' where id = $1`, [id]), '23514')
  })

  it.each(['red', '#12345', '#1234567', '#gggggg', '123456', '#12345g', ''])(
    'companies.color = "%s": rifiutato',
    async (color) => {
      await expectPgError(company(getDb(), { color }), '23514', /companies_color_check/)
    },
  )

  it.each(['#000000', '#a1b2c3', '#ABCDEF'])(
    'companies.color = "%s": accettato (maiuscole comprese)',
    async (color) => {
      await company(getDb(), { color })
    },
  )

  it('companies.name: da 1 a 120 caratteri', async () => {
    const db = getDb()
    await expectPgError(company(db, { name: '' }), '23514', /companies_name_check/)
    await expectPgError(company(db, { name: 'x'.repeat(121) }), '23514', /companies_name_check/)
    await company(db, { name: 'x'.repeat(120) })
  })

  it('altri vincoli: estimate_min >= 0, checklist array, profile oggetto', async () => {
    const db = getDb()
    await expectPgError(task(db, c, { estimate_min: -1 }), '23514', /estimate_min/)
    await expectPgError(task(db, c, { checklist: '{}' }), '23514', /checklist/)
    await expectPgError(company(db, { profile: '[]' }), '23514', /profile/)
  })

  it.each([0, 1, 10, 15, 31, 90])('user_settings.horizon_days = %i: rifiutato', async (horizon) => {
    await expectPgError(insert(getDb(), 'user_settings', { horizon_days: horizon }), '23514', /horizon_days/)
  })

  it('user_settings.horizon_days: 7, 14, 30, 60 accettati', async () => {
    const db = getDb()
    await insert(db, 'user_settings')
    for (const h of [7, 14, 30, 60]) {
      const res = await db.query('update public.user_settings set horizon_days = $1', [h])
      expect(res.affectedRows).toBe(1)
    }
  })

  it('user_settings.calendar_color_by: solo "company" o "priority"', async () => {
    const db = getDb()
    await expectPgError(
      insert(db, 'user_settings', { calendar_color_by: 'status' }),
      '23514',
      /calendar_color_by/,
    )
    await expectPgError(insert(db, 'user_settings', { calendar_color_by: '' }), '23514', /calendar_color_by/)
    const row = await insert<{ calendar_color_by: string; horizon_days: number }>(db, 'user_settings', {
      calendar_color_by: 'priority',
    })
    expect(row).toMatchObject({ calendar_color_by: 'priority', horizon_days: 14 })
    await expectPgError(db.query(`update public.user_settings set calendar_color_by = 'tag'`), '23514')
  })

  it('user_settings.available_hours: tra 0 e 24', async () => {
    const db = getDb()
    await expectPgError(insert(db, 'user_settings', { available_hours: 25 }), '23514', /available_hours/)
    await expectPgError(insert(db, 'user_settings', { available_hours: -1 }), '23514', /available_hours/)
  })

  it("tasks.status: solo i valori dell'enum", async () => {
    await expectPgError(task(getDb(), c, { status: 'archived' }), '22P02')
  })
})

describe('Realtime', () => {
  it('la publication supabase_realtime contiene esattamente companies, folders, tasks, task_links', async () => {
    const db = getDb()
    await asSuperuser(db)
    const res = await rows<{ schemaname: string; tablename: string }>(
      db,
      `select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename`,
    )
    expect(res).toEqual([
      { schemaname: 'public', tablename: 'companies' },
      { schemaname: 'public', tablename: 'folders' },
      { schemaname: 'public', tablename: 'task_links' },
      { schemaname: 'public', tablename: 'tasks' },
    ])
  })
})
