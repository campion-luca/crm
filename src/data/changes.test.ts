import { buildSeed } from '@/lib/seed'
import type { Snapshot, Task } from '@/lib/types'
import {
  counterIds,
  makeCompany,
  makeFolder,
  makeLink,
  makeTask,
  normalizeSnapshot,
  snapshotOf,
  TEST_TS,
  TEST_USER,
} from '@/test/factories'
import {
  applyChanges,
  changeKeys,
  ConstraintError,
  mergePending,
  withoutKeys,
  type ApplyOptions,
  type Change,
} from './changes'

const NOW = '2026-11-06T14:00:00.000Z'
const OPTS: ApplyOptions = { now: NOW, userId: TEST_USER }
const STRICT: ApplyOptions = { ...OPTS, strict: true }
const DONE_AT = '2026-11-05T10:00:00.000Z'

/**
 * c1 Pasta Monesi: f1, f2 — t1 (f1), t2 done (f1), t3 (senza cartella)
 * c2 Belelli: f3 — t4 (f3), t5 doing (f3), t6 (senza cartella)
 * link: t4→t5, t4→t6, t5→t6 (diamante), t4→t1 (tra aziende), t1→t3
 */
function base(): Snapshot {
  return snapshotOf({
    companies: [
      makeCompany({ id: 'c1', name: 'Pasta Monesi', position: 0 }),
      makeCompany({ id: 'c2', name: 'Belelli', color: '#12b76a', position: 1 }),
    ],
    folders: [
      makeFolder({ id: 'f1', company_id: 'c1', name: 'Social' }),
      makeFolder({ id: 'f2', company_id: 'c1', name: 'Sito', position: 1 }),
      makeFolder({ id: 'f3', company_id: 'c2', name: 'Campagna' }),
    ],
    tasks: [
      makeTask({ id: 't1', company_id: 'c1', folder_id: 'f1', title: 'Carosello' }),
      makeTask({
        id: 't2',
        company_id: 'c1',
        folder_id: 'f1',
        title: 'Reel',
        status: 'done',
        completed_at: DONE_AT,
      }),
      makeTask({ id: 't3', company_id: 'c1', title: 'Footer', priority: 1 }),
      makeTask({ id: 't4', company_id: 'c2', folder_id: 'f3', title: 'Call', due_time: '15:30' }),
      makeTask({ id: 't5', company_id: 'c2', folder_id: 'f3', title: 'Slide', status: 'doing' }),
      makeTask({
        id: 't6',
        company_id: 'c2',
        title: 'Loghi',
        checklist: [{ id: 'k1', text: 'Logo', done: false }],
      }),
    ],
    links: [
      makeLink('t4', 't5'),
      makeLink('t4', 't6'),
      makeLink('t5', 't6'),
      makeLink('t4', 't1'),
      makeLink('t1', 't3'),
    ],
  })
}

const task = (s: Snapshot, id: string): Task => {
  const t = s.tasks.find((x) => x.id === id)
  if (!t) throw new Error(`task ${id} non trovata`)
  return t
}
const ids = (rows: { id: string }[]) => rows.map((r) => r.id)
const linkKeys = (s: Snapshot) => s.links.map((l) => `${l.parent_id}>${l.child_id}`)

describe('applyChanges — upsert', () => {
  it('inserts a company, filling user_id, with a delete as inverse', () => {
    const s = base()
    const res = applyChanges(
      s,
      [{ op: 'upsert', table: 'companies', rows: [makeCompany({ id: 'c3', user_id: '' })] }],
      OPTS,
    )
    expect(ids(res.snapshot.companies)).toEqual(['c1', 'c2', 'c3'])
    expect(res.snapshot.companies[2]!.user_id).toBe(TEST_USER)
    expect(res.inverse).toEqual([{ op: 'delete', table: 'companies', ids: ['c3'] }])
    expect(res.touched).toEqual(['companies:c3'])
  })

  it('keeps an explicit user_id, and leaves it empty without opts.userId', () => {
    const s = base()
    const a = applyChanges(
      s,
      [{ op: 'upsert', table: 'companies', rows: [makeCompany({ id: 'c3', user_id: 'other' })] }],
      OPTS,
    )
    expect(a.snapshot.companies[2]!.user_id).toBe('other')
    const b = applyChanges(s, [
      { op: 'upsert', table: 'companies', rows: [makeCompany({ id: 'c3', user_id: '' })] },
    ])
    expect(b.snapshot.companies[2]!.user_id).toBe('')
  })

  it('updates a company in place, with the old row as inverse', () => {
    const s = base()
    const old = s.companies[0]!
    const res = applyChanges(
      s,
      [{ op: 'upsert', table: 'companies', rows: [{ ...old, name: 'Monesi Srl' }] }],
      OPTS,
    )
    expect(res.snapshot.companies.map((c) => c.name)).toEqual(['Monesi Srl', 'Belelli'])
    expect(res.inverse).toEqual([{ op: 'upsert', table: 'companies', rows: [old] }])
  })

  it('inserts and updates folders', () => {
    const s = base()
    const f1 = s.folders[0]!
    const res = applyChanges(
      s,
      [
        {
          op: 'upsert',
          table: 'folders',
          rows: [{ ...f1, name: 'Social 2' }, makeFolder({ id: 'f4', company_id: 'c2' })],
        },
      ],
      OPTS,
    )
    expect(res.snapshot.folders.map((f) => [f.id, f.name])).toEqual([
      ['f1', 'Social 2'],
      ['f2', 'Sito'],
      ['f3', 'Campagna'],
      ['f4', 'Cartella'],
    ])
    expect(res.inverse).toEqual([
      { op: 'delete', table: 'folders', ids: ['f4'] },
      { op: 'upsert', table: 'folders', rows: [f1] },
    ])
    expect(res.touched.sort()).toEqual(['folders:f1', 'folders:f4'])
  })

  it('inserts a task and refreshes updated_at', () => {
    const s = base()
    const res = applyChanges(
      s,
      [{ op: 'upsert', table: 'tasks', rows: [makeTask({ id: 't7', company_id: 'c2' })] }],
      OPTS,
    )
    expect(task(res.snapshot, 't7').updated_at).toBe(NOW)
    expect(res.inverse).toEqual([{ op: 'delete', table: 'tasks', ids: ['t7'] }])
  })

  it('updates a task in place', () => {
    const s = base()
    const old = task(s, 't4')
    const res = applyChanges(
      s,
      [{ op: 'upsert', table: 'tasks', rows: [{ ...old, title: 'Call spostata' }] }],
      OPTS,
    )
    expect(ids(res.snapshot.tasks)).toEqual(ids(s.tasks))
    expect(task(res.snapshot, 't4')).toMatchObject({ title: 'Call spostata', updated_at: NOW })
    expect(res.inverse).toEqual([{ op: 'upsert', table: 'tasks', rows: [old] }])
  })

  it('keeps completed_at consistent with the status', () => {
    const s = base()
    const res = applyChanges(
      s,
      [
        {
          op: 'upsert',
          table: 'tasks',
          rows: [
            makeTask({ id: 'doneNoDate', company_id: 'c1', status: 'done', completed_at: null }),
            makeTask({ id: 'doneWithDate', company_id: 'c1', status: 'done', completed_at: DONE_AT }),
            makeTask({ id: 'todoWithDate', company_id: 'c1', status: 'todo', completed_at: DONE_AT }),
          ],
        },
      ],
      OPTS,
    )
    expect(task(res.snapshot, 'doneNoDate').completed_at).toBe(NOW)
    expect(task(res.snapshot, 'doneWithDate').completed_at).toBe(DONE_AT)
    expect(task(res.snapshot, 'todoWithDate').completed_at).toBeNull()
  })

  it('duplicate ids in the same upsert: last row wins, inverse restores the starting state', () => {
    const s = base()
    const t1 = task(s, 't1')
    const fresh = makeTask({ id: 't9', company_id: 'c1', title: 'N1' })
    const res = applyChanges(
      s,
      [
        {
          op: 'upsert',
          table: 'tasks',
          rows: [{ ...t1, title: 'A' }, { ...t1, title: 'B' }, fresh, { ...fresh, title: 'N2' }],
        },
      ],
      OPTS,
    )
    expect(task(res.snapshot, 't1').title).toBe('B')
    expect(res.snapshot.tasks.filter((t) => t.id === 't9').map((t) => t.title)).toEqual(['N2'])
    const back = applyChanges(res.snapshot, res.inverse, OPTS)
    expect(normalizeSnapshot(back.snapshot)).toEqual(normalizeSnapshot(s))
  })
})

describe('applyChanges — patch', () => {
  it('changes only the given keys and refreshes updated_at of tasks', () => {
    const s = base()
    const res = applyChanges(
      s,
      [{ op: 'patch', table: 'tasks', id: 't4', patch: { title: 'Nuovo', priority: 1 } }],
      OPTS,
    )
    expect(task(res.snapshot, 't4')).toEqual({
      ...task(s, 't4'),
      title: 'Nuovo',
      priority: 1,
      updated_at: NOW,
    })
    expect(res.inverse).toEqual([
      { op: 'patch', table: 'tasks', id: 't4', patch: { title: 'Call', priority: 3 } },
    ])
    expect(res.touched).toEqual(['tasks:t4'])
  })

  it('cannot change id or user_id, and the inverse never contains id/user_id/updated_at', () => {
    const s = base()
    const res = applyChanges(
      s,
      [
        {
          op: 'patch',
          table: 'tasks',
          id: 't1',
          patch: { id: 'hack', user_id: 'other', updated_at: 'x', notes: 'n' },
        },
      ],
      OPTS,
    )
    expect(task(res.snapshot, 't1')).toMatchObject({
      id: 't1',
      user_id: TEST_USER,
      notes: 'n',
      updated_at: NOW,
    })
    expect(res.inverse).toEqual([{ op: 'patch', table: 'tasks', id: 't1', patch: { notes: '' } }])
  })

  it('patches companies and folders', () => {
    const s = base()
    const res = applyChanges(
      s,
      [
        { op: 'patch', table: 'companies', id: 'c2', patch: { name: 'Belelli Spa', position: 5 } },
        { op: 'patch', table: 'folders', id: 'f2', patch: { name: 'E-commerce' } },
      ],
      OPTS,
    )
    expect(res.snapshot.companies[1]).toEqual({ ...s.companies[1]!, name: 'Belelli Spa', position: 5 })
    expect(res.snapshot.folders[1]).toEqual({ ...s.folders[1]!, name: 'E-commerce' })
    expect(res.inverse).toEqual([
      { op: 'patch', table: 'folders', id: 'f2', patch: { name: 'Sito' } },
      { op: 'patch', table: 'companies', id: 'c2', patch: { name: 'Belelli', position: 1 } },
    ])
  })

  it('completing a task fills completed_at with now; the inverse clears it', () => {
    const s = base()
    const res = applyChanges(s, [{ op: 'patch', table: 'tasks', id: 't1', patch: { status: 'done' } }], OPTS)
    expect(task(res.snapshot, 't1')).toMatchObject({ status: 'done', completed_at: NOW })
    expect(res.inverse).toEqual([
      { op: 'patch', table: 'tasks', id: 't1', patch: { status: 'todo', completed_at: null } },
    ])
  })

  it('completing with an explicit completed_at keeps it', () => {
    const s = base()
    const res = applyChanges(
      s,
      [{ op: 'patch', table: 'tasks', id: 't1', patch: { status: 'done', completed_at: DONE_AT } }],
      OPTS,
    )
    expect(task(res.snapshot, 't1').completed_at).toBe(DONE_AT)
  })

  it('reopening a task clears completed_at; the inverse restores the old value', () => {
    const s = base()
    const res = applyChanges(
      s,
      [{ op: 'patch', table: 'tasks', id: 't2', patch: { status: 'review' } }],
      OPTS,
    )
    expect(task(res.snapshot, 't2')).toMatchObject({ status: 'review', completed_at: null })
    expect(res.inverse).toEqual([
      { op: 'patch', table: 'tasks', id: 't2', patch: { status: 'done', completed_at: DONE_AT } },
    ])
    const back = applyChanges(res.snapshot, res.inverse, OPTS)
    expect(task(back.snapshot, 't2')).toMatchObject({ status: 'done', completed_at: DONE_AT })
  })

  it('completed_at on an open task is forced to null', () => {
    const s = base()
    const res = applyChanges(
      s,
      [{ op: 'patch', table: 'tasks', id: 't1', patch: { completed_at: DONE_AT } }],
      OPTS,
    )
    expect(task(res.snapshot, 't1').completed_at).toBeNull()
  })

  it('patching a missing row is a no-op', () => {
    const s = base()
    const res = applyChanges(s, [{ op: 'patch', table: 'tasks', id: 'ghost', patch: { title: 'x' } }], OPTS)
    expect(res.inverse).toEqual([])
    expect(res.touched).toEqual([])
    expect(res.snapshot.tasks).toBe(s.tasks)
  })
})

describe('applyChanges — delete', () => {
  it('deleting a company cascades to its folders, tasks and their links', () => {
    const s = base()
    const res = applyChanges(s, [{ op: 'delete', table: 'companies', ids: ['c1'] }], OPTS)
    expect(ids(res.snapshot.companies)).toEqual(['c2'])
    expect(ids(res.snapshot.folders)).toEqual(['f3'])
    expect(ids(res.snapshot.tasks)).toEqual(['t4', 't5', 't6'])
    expect(linkKeys(res.snapshot)).toEqual(['t4>t5', 't4>t6', 't5>t6'])
    expect(res.touched.sort()).toEqual(
      [
        'companies:c1',
        'folders:f1',
        'folders:f2',
        'tasks:t1',
        'tasks:t2',
        'tasks:t3',
        'task_links:t4:t1',
        'task_links:t1:t3',
      ].sort(),
    )
  })

  it('the inverse of a company delete re-creates everything in FK order', () => {
    const s = base()
    const res = applyChanges(s, [{ op: 'delete', table: 'companies', ids: ['c1'] }], OPTS)
    expect(res.inverse.map((c) => `${c.op}:${c.table}`)).toEqual([
      'upsert:companies',
      'upsert:folders',
      'upsert:tasks',
      'upsert:task_links',
    ])
    expect(res.inverse[0]).toEqual({ op: 'upsert', table: 'companies', rows: [s.companies[0]] })
    expect(res.inverse[1]).toEqual({ op: 'upsert', table: 'folders', rows: s.folders.slice(0, 2) })
    expect(res.inverse[2]).toEqual({ op: 'upsert', table: 'tasks', rows: s.tasks.slice(0, 3) })
    expect(res.inverse[3]).toEqual({
      op: 'upsert',
      table: 'task_links',
      rows: [
        { parent_id: 't4', child_id: 't1' },
        { parent_id: 't1', child_id: 't3' },
      ],
    })
    // rispetta i vincoli anche in strict
    const back = applyChanges(res.snapshot, res.inverse, STRICT)
    expect(normalizeSnapshot(back.snapshot)).toEqual(normalizeSnapshot(s))
  })

  it('a company without folders/tasks yields only the company in the inverse', () => {
    const s = applyChanges(
      base(),
      [{ op: 'upsert', table: 'companies', rows: [makeCompany({ id: 'c3' })] }],
      OPTS,
    ).snapshot
    const res = applyChanges(s, [{ op: 'delete', table: 'companies', ids: ['c3'] }], OPTS)
    expect(res.inverse).toEqual([{ op: 'upsert', table: 'companies', rows: [s.companies[2]] }])
  })

  it('deleting a folder sets folder_id to null on its tasks; the inverse restores it', () => {
    const s = base()
    const res = applyChanges(s, [{ op: 'delete', table: 'folders', ids: ['f1'] }], OPTS)
    expect(ids(res.snapshot.folders)).toEqual(['f2', 'f3'])
    expect(ids(res.snapshot.tasks)).toEqual(ids(s.tasks))
    expect(task(res.snapshot, 't1')).toMatchObject({ folder_id: null, updated_at: NOW })
    expect(task(res.snapshot, 't2').folder_id).toBeNull()
    expect(task(res.snapshot, 't3')).toBe(task(s, 't3'))
    expect(res.inverse).toEqual([
      { op: 'upsert', table: 'folders', rows: [s.folders[0]] },
      { op: 'patch', table: 'tasks', id: 't1', patch: { folder_id: 'f1' } },
      { op: 'patch', table: 'tasks', id: 't2', patch: { folder_id: 'f1' } },
    ])
    expect(res.touched.sort()).toEqual(['folders:f1', 'tasks:t1', 'tasks:t2'])
    const back = applyChanges(res.snapshot, res.inverse, STRICT)
    expect(task(back.snapshot, 't1').folder_id).toBe('f1')
    expect(normalizeSnapshot(back.snapshot)).toEqual(normalizeSnapshot(s))
  })

  it('deleting a task removes its links (as parent and as child)', () => {
    const s = base()
    const res = applyChanges(s, [{ op: 'delete', table: 'tasks', ids: ['t1'] }], OPTS)
    expect(ids(res.snapshot.tasks)).toEqual(['t2', 't3', 't4', 't5', 't6'])
    expect(linkKeys(res.snapshot)).toEqual(['t4>t5', 't4>t6', 't5>t6'])
    expect(res.inverse).toEqual([
      { op: 'upsert', table: 'tasks', rows: [s.tasks[0]] },
      {
        op: 'upsert',
        table: 'task_links',
        rows: [
          { parent_id: 't4', child_id: 't1' },
          { parent_id: 't1', child_id: 't3' },
        ],
      },
    ])
  })

  it('deleting a task without links has only the task in the inverse', () => {
    const s = base()
    const res = applyChanges(s, [{ op: 'delete', table: 'tasks', ids: ['t2'] }], OPTS)
    expect(res.inverse).toEqual([{ op: 'upsert', table: 'tasks', rows: [s.tasks[1]] }])
    expect(res.snapshot.links).toEqual(s.links)
  })

  it('deleting missing rows is a no-op', () => {
    const s = base()
    for (const table of ['companies', 'folders', 'tasks'] as const) {
      const res = applyChanges(s, [{ op: 'delete', table, ids: ['ghost'] }], OPTS)
      expect(res.inverse).toEqual([])
      expect(res.touched).toEqual([])
      expect(normalizeSnapshot(res.snapshot)).toEqual(normalizeSnapshot(s))
    }
  })
})

describe('applyChanges — task links', () => {
  it('adds a link with the user id; inverse deletes it', () => {
    const s = base()
    const res = applyChanges(
      s,
      [{ op: 'upsert', table: 'task_links', rows: [{ parent_id: 't3', child_id: 't2' }] }],
      OPTS,
    )
    expect(res.snapshot.links.at(-1)).toEqual({ parent_id: 't3', child_id: 't2', user_id: TEST_USER })
    expect(res.inverse).toEqual([
      { op: 'delete', table: 'task_links', keys: [{ parent_id: 't3', child_id: 't2' }] },
    ])
    expect(res.touched).toEqual(['task_links:t3:t2'])
  })

  it('without opts.userId the new link has an empty user_id', () => {
    const res = applyChanges(base(), [
      { op: 'upsert', table: 'task_links', rows: [{ parent_id: 't3', child_id: 't2' }] },
    ])
    expect(res.snapshot.links.at(-1)!.user_id).toBe('')
  })

  it('upserting an existing link is idempotent', () => {
    const s = base()
    const res = applyChanges(
      s,
      [
        {
          op: 'upsert',
          table: 'task_links',
          rows: [
            { parent_id: 't4', child_id: 't5' },
            { parent_id: 't4', child_id: 't5' },
          ],
        },
      ],
      OPTS,
    )
    expect(res.snapshot.links).toBe(s.links)
    expect(res.inverse).toEqual([])
    expect(res.touched).toEqual([])
  })

  it('the same new link twice in a batch is added once', () => {
    const s = base()
    const pair = { parent_id: 't3', child_id: 't2' }
    const res = applyChanges(s, [{ op: 'upsert', table: 'task_links', rows: [pair, pair] }], OPTS)
    expect(res.snapshot.links).toHaveLength(s.links.length + 1)
    expect(res.inverse).toEqual([{ op: 'delete', table: 'task_links', keys: [pair] }])
  })

  it('non-strict: links that would create a cycle are skipped, the others applied', () => {
    const s = base()
    const res = applyChanges(
      s,
      [
        {
          op: 'upsert',
          table: 'task_links',
          rows: [
            { parent_id: 't6', child_id: 't4' }, // t4 → t6 esiste già: ciclo
            { parent_id: 't3', child_id: 't4' }, // t4 → t1 → t3: ciclo indiretto
            { parent_id: 't2', child_id: 't2' }, // self
            { parent_id: 't2', child_id: 't5' }, // ok
          ],
        },
      ],
      OPTS,
    )
    expect(linkKeys(res.snapshot)).toEqual([...linkKeys(s), 't2>t5'])
    expect(res.inverse).toEqual([
      { op: 'delete', table: 'task_links', keys: [{ parent_id: 't2', child_id: 't5' }] },
    ])
  })

  it('cycle detection sees links added earlier in the same batch', () => {
    const s = base()
    const res = applyChanges(
      s,
      [
        {
          op: 'upsert',
          table: 'task_links',
          rows: [
            { parent_id: 't3', child_id: 't2' },
            { parent_id: 't2', child_id: 't3' },
          ],
        },
      ],
      OPTS,
    )
    expect(linkKeys(res.snapshot)).toEqual([...linkKeys(s), 't3>t2'])
  })

  it('diamonds are fine', () => {
    const s = base()
    // t4 → t1 → t3 esiste: anche t4 → t3 è valido
    const res = applyChanges(
      s,
      [{ op: 'upsert', table: 'task_links', rows: [{ parent_id: 't4', child_id: 't3' }] }],
      STRICT,
    )
    expect(linkKeys(res.snapshot)).toContain('t4>t3')
  })

  it('strict: a cycle throws ConstraintError', () => {
    const s = base()
    expect(() =>
      applyChanges(
        s,
        [{ op: 'upsert', table: 'task_links', rows: [{ parent_id: 't6', child_id: 't4' }] }],
        STRICT,
      ),
    ).toThrow(ConstraintError)
    expect(() =>
      applyChanges(
        s,
        [{ op: 'upsert', table: 'task_links', rows: [{ parent_id: 't1', child_id: 't1' }] }],
        STRICT,
      ),
    ).toThrow(/ciclo/)
  })

  it('strict: links to unknown tasks throw', () => {
    expect(() =>
      applyChanges(
        base(),
        [{ op: 'upsert', table: 'task_links', rows: [{ parent_id: 't1', child_id: 'ghost' }] }],
        STRICT,
      ),
    ).toThrow(ConstraintError)
  })

  it('deletes links by key; inverse re-adds them; missing keys are ignored', () => {
    const s = base()
    const res = applyChanges(
      s,
      [
        {
          op: 'delete',
          table: 'task_links',
          keys: [
            { parent_id: 't4', child_id: 't5' },
            { parent_id: 't5', child_id: 't4' },
          ],
        },
      ],
      OPTS,
    )
    expect(linkKeys(res.snapshot)).toEqual(['t4>t6', 't5>t6', 't4>t1', 't1>t3'])
    expect(res.inverse).toEqual([
      { op: 'upsert', table: 'task_links', rows: [{ parent_id: 't4', child_id: 't5' }] },
    ])
    expect(res.touched).toEqual(['task_links:t4:t5'])
    const none = applyChanges(
      s,
      [{ op: 'delete', table: 'task_links', keys: [{ parent_id: 'x', child_id: 'y' }] }],
      OPTS,
    )
    expect(none.inverse).toEqual([])
    expect(none.snapshot.links).toBe(s.links)
  })
})

describe('applyChanges — strict constraints', () => {
  it('rejects a task of an unknown company', () => {
    expect(() =>
      applyChanges(
        base(),
        [{ op: 'upsert', table: 'tasks', rows: [makeTask({ id: 'x', company_id: 'ghost' })] }],
        STRICT,
      ),
    ).toThrow(ConstraintError)
  })

  it('rejects a task in a folder of another company', () => {
    expect(() =>
      applyChanges(
        base(),
        [{ op: 'upsert', table: 'tasks', rows: [makeTask({ id: 'x', company_id: 'c1', folder_id: 'f3' })] }],
        STRICT,
      ),
    ).toThrow(/Cartella f3/)
  })

  it('rejects a task in an unknown folder', () => {
    expect(() =>
      applyChanges(
        base(),
        [
          {
            op: 'upsert',
            table: 'tasks',
            rows: [makeTask({ id: 'x', company_id: 'c1', folder_id: 'nope' })],
          },
        ],
        STRICT,
      ),
    ).toThrow(ConstraintError)
  })

  it('rejects a folder of an unknown company', () => {
    expect(() =>
      applyChanges(
        base(),
        [{ op: 'upsert', table: 'folders', rows: [makeFolder({ id: 'x', company_id: 'ghost' })] }],
        STRICT,
      ),
    ).toThrow(/Azienda ghost/)
  })

  it('rejects a patch that moves a task into a folder of another company', () => {
    expect(() =>
      applyChanges(base(), [{ op: 'patch', table: 'tasks', id: 't1', patch: { folder_id: 'f3' } }], STRICT),
    ).toThrow(ConstraintError)
  })

  it('accepts rows that reference rows created earlier in the same batch', () => {
    const res = applyChanges(
      base(),
      [
        { op: 'upsert', table: 'companies', rows: [makeCompany({ id: 'c3' })] },
        { op: 'upsert', table: 'folders', rows: [makeFolder({ id: 'f4', company_id: 'c3' })] },
        { op: 'upsert', table: 'tasks', rows: [makeTask({ id: 't7', company_id: 'c3', folder_id: 'f4' })] },
        { op: 'upsert', table: 'task_links', rows: [{ parent_id: 't7', child_id: 't1' }] },
      ],
      STRICT,
    )
    expect(task(res.snapshot, 't7').folder_id).toBe('f4')
  })

  it('a rejected batch leaves the input snapshot untouched', () => {
    const s = base()
    const before = structuredClone(s)
    expect(() =>
      applyChanges(
        s,
        [
          { op: 'patch', table: 'tasks', id: 't1', patch: { title: 'cambiato' } },
          { op: 'delete', table: 'folders', ids: ['f1'] },
          { op: 'upsert', table: 'tasks', rows: [makeTask({ id: 'x', company_id: 'ghost' })] },
        ],
        STRICT,
      ),
    ).toThrow(ConstraintError)
    expect(s).toEqual(before)
  })

  it('non-strict (cache) does not check references: current behaviour inserts the row', () => {
    const res = applyChanges(
      base(),
      [
        { op: 'upsert', table: 'tasks', rows: [makeTask({ id: 'x', company_id: 'ghost', folder_id: 'f3' })] },
        { op: 'patch', table: 'tasks', id: 't1', patch: { folder_id: 'f3' } },
      ],
      OPTS,
    )
    expect(task(res.snapshot, 'x').company_id).toBe('ghost')
    expect(task(res.snapshot, 't1').folder_id).toBe('f3')
  })
})

describe('applyChanges — immutability and identity', () => {
  it('never mutates the input snapshot', () => {
    const s = base()
    const before = structuredClone(s)
    applyChanges(
      s,
      [
        { op: 'patch', table: 'tasks', id: 't1', patch: { status: 'done' } },
        { op: 'upsert', table: 'companies', rows: [{ ...s.companies[0]!, name: 'X' }] },
        { op: 'delete', table: 'folders', ids: ['f3'] },
        { op: 'delete', table: 'tasks', ids: ['t4'] },
        { op: 'upsert', table: 'task_links', rows: [{ parent_id: 't3', child_id: 't2' }] },
      ],
      OPTS,
    )
    expect(s).toEqual(before)
  })

  it('tables that are not touched keep their array identity', () => {
    const s = base()
    const onlyTasks = applyChanges(
      s,
      [{ op: 'patch', table: 'tasks', id: 't1', patch: { title: 'x' } }],
      OPTS,
    ).snapshot
    expect(onlyTasks.companies).toBe(s.companies)
    expect(onlyTasks.folders).toBe(s.folders)
    expect(onlyTasks.links).toBe(s.links)
    expect(onlyTasks.tasks).not.toBe(s.tasks)

    const onlyCompanies = applyChanges(
      s,
      [{ op: 'upsert', table: 'companies', rows: [makeCompany({ id: 'c9' })] }],
      OPTS,
    ).snapshot
    expect(onlyCompanies.folders).toBe(s.folders)
    expect(onlyCompanies.tasks).toBe(s.tasks)
    expect(onlyCompanies.links).toBe(s.links)

    const onlyLinks = applyChanges(
      s,
      [{ op: 'upsert', table: 'task_links', rows: [{ parent_id: 't3', child_id: 't2' }] }],
      OPTS,
    ).snapshot
    expect(onlyLinks.companies).toBe(s.companies)
    expect(onlyLinks.folders).toBe(s.folders)
    expect(onlyLinks.tasks).toBe(s.tasks)

    const linkDelete = applyChanges(
      s,
      [{ op: 'delete', table: 'task_links', keys: [{ parent_id: 't4', child_id: 't5' }] }],
      OPTS,
    ).snapshot
    expect(linkDelete.tasks).toBe(s.tasks)

    const folderPatch = applyChanges(
      s,
      [{ op: 'patch', table: 'folders', id: 'f1', patch: { name: 'z' } }],
      OPTS,
    ).snapshot
    expect(folderPatch.companies).toBe(s.companies)
    expect(folderPatch.tasks).toBe(s.tasks)
  })

  it('an empty batch returns the same tables', () => {
    const s = base()
    const res = applyChanges(s, [], OPTS)
    expect(res.snapshot).toEqual(s)
    expect(res.snapshot.tasks).toBe(s.tasks)
    expect(res.inverse).toEqual([])
    expect(res.touched).toEqual([])
  })

  it('uses the current time when opts.now is missing', () => {
    const before = Date.now()
    const res = applyChanges(base(), [{ op: 'patch', table: 'tasks', id: 't1', patch: { status: 'done' } }])
    const t = task(res.snapshot, 't1')
    expect(Date.parse(t.completed_at!)).toBeGreaterThanOrEqual(before)
    expect(t.updated_at).toBe(t.completed_at)
  })
})

describe('applyChanges — inverse round trip', () => {
  const s0 = base()
  const t = (id: string) => task(s0, id)
  const newCompany = makeCompany({ id: 'c3', name: 'Hybrix', user_id: '' })
  const newFolder = makeFolder({ id: 'f4', company_id: 'c3', name: 'Lancio' })
  const newTask = makeTask({
    id: 't7',
    company_id: 'c3',
    folder_id: 'f4',
    title: 'Video',
    status: 'done',
    completed_at: null,
  })
  const seed = buildSeed('2026-11-06', new Date(2026, 10, 6, 15, 25), { makeId: counterIds('seed') })

  const cases: { name: string; changes: Change[]; nonStrictOnly?: boolean; noop?: boolean }[] = [
    { name: 'insert company', changes: [{ op: 'upsert', table: 'companies', rows: [newCompany] }] },
    {
      name: 'update company',
      changes: [
        { op: 'upsert', table: 'companies', rows: [{ ...s0.companies[0]!, name: 'X', color: '#000000' }] },
      ],
    },
    {
      name: 'patch company',
      changes: [{ op: 'patch', table: 'companies', id: 'c2', patch: { name: 'Y', position: 9 } }],
    },
    {
      name: 'insert folder',
      changes: [{ op: 'upsert', table: 'folders', rows: [makeFolder({ id: 'f5', company_id: 'c2' })] }],
    },
    {
      name: 'update + insert folders',
      changes: [
        {
          op: 'upsert',
          table: 'folders',
          rows: [{ ...s0.folders[0]!, name: 'Z' }, makeFolder({ id: 'f5', company_id: 'c1' })],
        },
      ],
    },
    {
      name: 'patch folder',
      changes: [{ op: 'patch', table: 'folders', id: 'f2', patch: { name: 'W', position: 3 } }],
    },
    {
      name: 'insert done task without completed_at',
      changes: [
        {
          op: 'upsert',
          table: 'tasks',
          rows: [makeTask({ id: 't8', company_id: 'c1', status: 'done', completed_at: null })],
        },
      ],
    },
    {
      name: 'update task via upsert (completes it)',
      changes: [
        {
          op: 'upsert',
          table: 'tasks',
          rows: [{ ...t('t1'), status: 'done', completed_at: null, title: 'fatto' }],
        },
      ],
    },
    {
      name: 'patch many task fields',
      changes: [
        {
          op: 'patch',
          table: 'tasks',
          id: 't6',
          patch: {
            title: 'Loghi HD',
            notes: 'vettoriali',
            priority: 1,
            due_date: '2026-11-20',
            due_time: '09:00',
            estimate_min: 15,
            link: 'https://example.com',
            checklist: [{ id: 'k2', text: 'Nuovo', done: true }],
          },
        },
      ],
    },
    {
      name: 'complete task',
      changes: [{ op: 'patch', table: 'tasks', id: 't1', patch: { status: 'done' } }],
    },
    { name: 'reopen task', changes: [{ op: 'patch', table: 'tasks', id: 't2', patch: { status: 'todo' } }] },
    {
      name: 'move task to another folder',
      changes: [{ op: 'patch', table: 'tasks', id: 't3', patch: { folder_id: 'f2' } }],
    },
    {
      name: 'move task to another company',
      changes: [{ op: 'patch', table: 'tasks', id: 't6', patch: { company_id: 'c1', folder_id: 'f1' } }],
    },
    { name: 'delete company (cascade)', changes: [{ op: 'delete', table: 'companies', ids: ['c1'] }] },
    { name: 'delete all companies', changes: [{ op: 'delete', table: 'companies', ids: ['c1', 'c2'] }] },
    { name: 'delete folder', changes: [{ op: 'delete', table: 'folders', ids: ['f1'] }] },
    {
      name: 'delete folders of two companies',
      changes: [{ op: 'delete', table: 'folders', ids: ['f1', 'f3'] }],
    },
    { name: 'delete task with links', changes: [{ op: 'delete', table: 'tasks', ids: ['t4'] }] },
    { name: 'delete several tasks', changes: [{ op: 'delete', table: 'tasks', ids: ['t5', 't6', 't1'] }] },
    {
      name: 'add links',
      changes: [
        {
          op: 'upsert',
          table: 'task_links',
          rows: [
            { parent_id: 't3', child_id: 't2' },
            { parent_id: 't6', child_id: 't2' },
            { parent_id: 't4', child_id: 't5' },
          ],
        },
      ],
    },
    {
      name: 'remove links',
      changes: [
        {
          op: 'delete',
          table: 'task_links',
          keys: [
            { parent_id: 't4', child_id: 't5' },
            { parent_id: 't1', child_id: 't3' },
          ],
        },
      ],
    },
    {
      name: 'links with a cycle (skipped)',
      nonStrictOnly: true,
      changes: [
        {
          op: 'upsert',
          table: 'task_links',
          rows: [
            { parent_id: 't6', child_id: 't4' },
            { parent_id: 't2', child_id: 't5' },
          ],
        },
      ],
    },
    {
      name: 'mixed batch',
      changes: [
        { op: 'upsert', table: 'companies', rows: [newCompany] },
        { op: 'upsert', table: 'folders', rows: [newFolder] },
        { op: 'upsert', table: 'tasks', rows: [newTask] },
        { op: 'upsert', table: 'task_links', rows: [{ parent_id: 't7', child_id: 't1' }] },
        { op: 'patch', table: 'tasks', id: 't1', patch: { status: 'done' } },
        { op: 'delete', table: 'tasks', ids: ['t5'] },
        { op: 'delete', table: 'folders', ids: ['f2'] },
        { op: 'patch', table: 'companies', id: 'c1', patch: { color: '#ff5a5f' } },
      ],
    },
    {
      name: 'patch then delete the same task',
      changes: [
        { op: 'patch', table: 'tasks', id: 't1', patch: { title: 'temp' } },
        { op: 'delete', table: 'tasks', ids: ['t1'] },
      ],
    },
    {
      name: 'delete then re-create a task',
      changes: [
        { op: 'delete', table: 'tasks', ids: ['t4'] },
        { op: 'upsert', table: 'tasks', rows: [{ ...t('t4'), title: 'Nuova call' }] },
      ],
    },
    {
      name: 'delete a folder, then its company',
      changes: [
        { op: 'delete', table: 'folders', ids: ['f1'] },
        { op: 'delete', table: 'companies', ids: ['c1'] },
      ],
    },
    {
      name: 'replace everything (restore backup)',
      changes: [
        { op: 'delete', table: 'companies', ids: ['c1', 'c2'] },
        { op: 'upsert', table: 'companies', rows: seed.companies },
        { op: 'upsert', table: 'folders', rows: seed.folders },
        { op: 'upsert', table: 'tasks', rows: seed.tasks },
        { op: 'upsert', table: 'task_links', rows: seed.links },
      ],
    },
    {
      name: 'append the sample data',
      changes: [
        { op: 'upsert', table: 'companies', rows: seed.companies },
        { op: 'upsert', table: 'folders', rows: seed.folders },
        { op: 'upsert', table: 'tasks', rows: seed.tasks },
        { op: 'upsert', table: 'task_links', rows: seed.links },
      ],
    },
    {
      name: 'duplicate ids in one upsert',
      changes: [
        {
          op: 'upsert',
          table: 'tasks',
          rows: [
            { ...t('t1'), title: 'A' },
            { ...t('t1'), title: 'B' },
            newTask,
            { ...newTask, company_id: 'c1', folder_id: null },
          ],
        },
      ],
      nonStrictOnly: true, // newTask (c3) non esiste qui
    },
    {
      name: 'no-op changes',
      noop: true,
      changes: [
        { op: 'patch', table: 'tasks', id: 'ghost', patch: { title: 'x' } },
        { op: 'delete', table: 'tasks', ids: ['ghost'] },
        { op: 'delete', table: 'companies', ids: ['ghost'] },
        { op: 'delete', table: 'task_links', keys: [{ parent_id: 'a', child_id: 'b' }] },
        { op: 'upsert', table: 'task_links', rows: [{ parent_id: 't4', child_id: 't5' }] },
      ],
    },
  ]

  describe.each([
    ['cache (non-strict)', OPTS],
    ['strict', STRICT],
  ] as const)('%s', (_mode, opts) => {
    it.each(cases.filter((c) => !(opts.strict && c.nonStrictOnly)))('$name', ({ changes, noop }) => {
      const s = base()
      const fwd = applyChanges(s, changes, opts)
      if (noop) expect(normalizeSnapshot(fwd.snapshot)).toEqual(normalizeSnapshot(s))
      else expect(normalizeSnapshot(fwd.snapshot)).not.toEqual(normalizeSnapshot(s))
      const back = applyChanges(fwd.snapshot, fwd.inverse, opts)
      expect(normalizeSnapshot(back.snapshot)).toEqual(normalizeSnapshot(s))
      // e l'inversa dell'inversa riporta allo stato dopo la modifica
      const again = applyChanges(back.snapshot, back.inverse, opts)
      expect(normalizeSnapshot(again.snapshot)).toEqual(normalizeSnapshot(fwd.snapshot))
    })
  })

  it('every touched key is covered by the forward changes or their cascades', () => {
    const fwd = applyChanges(base(), [{ op: 'delete', table: 'companies', ids: ['c2'] }], OPTS)
    expect(fwd.touched).toEqual(
      expect.arrayContaining(['companies:c2', 'folders:f3', 'tasks:t4', 'task_links:t4:t1']),
    )
    expect(new Set(fwd.touched).size).toBe(fwd.touched.length)
  })

  it('updated_at is the only task field that changes after a round trip', () => {
    const s = base()
    const fwd = applyChanges(s, [{ op: 'delete', table: 'companies', ids: ['c1'] }], OPTS)
    const back = applyChanges(fwd.snapshot, fwd.inverse, OPTS)
    const t1 = task(back.snapshot, 't1')
    expect(t1).toEqual({ ...task(s, 't1'), updated_at: NOW })
    expect(task(s, 't1').updated_at).toBe(TEST_TS)
  })
})

describe('changeKeys', () => {
  it('returns table:id keys without cascades', () => {
    expect(
      changeKeys({ op: 'upsert', table: 'tasks', rows: [makeTask({ id: 'a' }), makeTask({ id: 'b' })] }),
    ).toEqual(['tasks:a', 'tasks:b'])
    expect(
      changeKeys({ op: 'upsert', table: 'task_links', rows: [{ parent_id: 'p', child_id: 'c' }] }),
    ).toEqual(['task_links:p:c'])
    expect(changeKeys({ op: 'patch', table: 'folders', id: 'f', patch: { name: 'x' } })).toEqual([
      'folders:f',
    ])
    expect(changeKeys({ op: 'delete', table: 'companies', ids: ['c1', 'c2'] })).toEqual([
      'companies:c1',
      'companies:c2',
    ])
    expect(
      changeKeys({ op: 'delete', table: 'task_links', keys: [{ parent_id: 'p', child_id: 'c' }] }),
    ).toEqual(['task_links:p:c'])
  })
})

describe('withoutKeys', () => {
  const skip = (keys: string[]) => (k: string) => keys.includes(k)

  it('filters upsert rows and returns null when nothing is left', () => {
    const ch: Change = { op: 'upsert', table: 'tasks', rows: [makeTask({ id: 'a' }), makeTask({ id: 'b' })] }
    const out = withoutKeys(ch, skip(['tasks:a']))
    expect(out).toMatchObject({ op: 'upsert', table: 'tasks' })
    expect(out && out.op === 'upsert' ? ids(out.rows as { id: string }[]) : null).toEqual(['b'])
    expect(withoutKeys(ch, skip(['tasks:a', 'tasks:b']))).toBeNull()
    expect(ch.rows).toHaveLength(2) // l'originale non cambia
  })

  it('filters link upserts and deletes', () => {
    const up: Change = {
      op: 'upsert',
      table: 'task_links',
      rows: [
        { parent_id: 'p', child_id: 'a' },
        { parent_id: 'p', child_id: 'b' },
      ],
    }
    expect(withoutKeys(up, skip(['task_links:p:a']))).toEqual({
      ...up,
      rows: [{ parent_id: 'p', child_id: 'b' }],
    })
    const del: Change = { op: 'delete', table: 'task_links', keys: [{ parent_id: 'p', child_id: 'a' }] }
    expect(withoutKeys(del, skip(['task_links:p:a']))).toBeNull()
    expect(withoutKeys(del, skip([]))).toEqual(del)
  })

  it('patch is kept or dropped as a whole', () => {
    const ch: Change = { op: 'patch', table: 'tasks', id: 'a', patch: { title: 'x' } }
    expect(withoutKeys(ch, skip([]))).toBe(ch)
    expect(withoutKeys(ch, skip(['tasks:a']))).toBeNull()
  })

  it('filters delete ids', () => {
    const ch: Change = { op: 'delete', table: 'folders', ids: ['a', 'b'] }
    expect(withoutKeys(ch, skip(['folders:b']))).toEqual({ op: 'delete', table: 'folders', ids: ['a'] })
    expect(withoutKeys(ch, skip(['folders:a', 'folders:b']))).toBeNull()
  })
})

describe('mergePending', () => {
  const cur = snapshotOf({
    companies: [makeCompany({ id: 'c1', name: 'cache' })],
    tasks: [
      makeTask({ id: 'a', title: 'a-cache' }),
      makeTask({ id: 'b', title: 'b-cache' }),
      makeTask({ id: 'new', title: 'creata in locale' }),
    ],
    links: [makeLink('a', 'new')],
  })
  const fresh = snapshotOf({
    companies: [makeCompany({ id: 'c1', name: 'server' })],
    tasks: [
      makeTask({ id: 'a', title: 'a-server' }),
      makeTask({ id: 'b', title: 'b-server' }),
      makeTask({ id: 'gone', title: 'eliminata in locale' }),
      makeTask({ id: 'other', title: 'altro dispositivo' }),
    ],
    links: [makeLink('a', 'b')],
  })

  it('returns fresh as-is without current data or pending keys', () => {
    expect(mergePending(fresh, undefined, new Set(['tasks:a']))).toBe(fresh)
    expect(mergePending(fresh, cur, new Set())).toBe(fresh)
  })

  it('pending rows keep the cache version (present or absent); the rest comes from the server', () => {
    const out = mergePending(
      fresh,
      cur,
      new Set(['tasks:a', 'tasks:new', 'tasks:gone', 'task_links:a:new', 'task_links:a:b']),
    )
    expect(out.tasks.map((t) => t.title)).toEqual([
      'a-cache',
      'b-server',
      'altro dispositivo',
      'creata in locale',
    ])
    expect(out.links.map((l) => `${l.parent_id}>${l.child_id}`)).toEqual(['a>new'])
    expect(out.companies[0]!.name).toBe('server')
  })

  it('a pending row present in both keeps its position in the fresh list', () => {
    const out = mergePending(fresh, cur, new Set(['tasks:b']))
    expect(out.tasks.map((t) => t.id)).toEqual(['a', 'b', 'gone', 'other'])
    expect(out.tasks[1]!.title).toBe('b-cache')
  })

  it('applies to companies and folders too', () => {
    const out = mergePending(fresh, cur, new Set(['companies:c1']))
    expect(out.companies[0]!.name).toBe('cache')
  })
})
