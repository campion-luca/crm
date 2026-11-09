import { makeTask } from '@/test/factories'
import {
  compareByTime,
  compareTasks,
  filterTasks,
  inScope,
  isOpen,
  isOver,
  matchesDue,
  sortTasks,
  sumEstimate,
  summaryCounts,
  type FilterContext,
} from './filters'

const TODAY = '2026-11-06'

describe('isOpen / isOver', () => {
  it('isOpen is false only for done', () => {
    expect(isOpen({ status: 'todo' })).toBe(true)
    expect(isOpen({ status: 'review' })).toBe(true)
    expect(isOpen({ status: 'done' })).toBe(false)
  })

  it('isOver: open with a past due date', () => {
    expect(isOver({ status: 'todo', due_date: '2026-11-05' }, TODAY)).toBe(true)
    expect(isOver({ status: 'doing', due_date: '2025-01-01' }, TODAY)).toBe(true)
  })

  it('isOver: false for today, future, done or missing date', () => {
    expect(isOver({ status: 'todo', due_date: TODAY }, TODAY)).toBe(false)
    expect(isOver({ status: 'todo', due_date: '2026-11-07' }, TODAY)).toBe(false)
    expect(isOver({ status: 'done', due_date: '2026-11-01' }, TODAY)).toBe(false)
    expect(isOver({ status: 'todo', due_date: '' }, TODAY)).toBe(false)
  })
})

describe('inScope', () => {
  const t = { company_id: 'c1', folder_id: 'f1' }
  it('no scope matches everything', () => {
    expect(inScope(t, { companyId: null, folderId: null })).toBe(true)
  })
  it('filters by company and folder', () => {
    expect(inScope(t, { companyId: 'c1', folderId: null })).toBe(true)
    expect(inScope(t, { companyId: 'c2', folderId: null })).toBe(false)
    expect(inScope(t, { companyId: 'c1', folderId: 'f1' })).toBe(true)
    expect(inScope(t, { companyId: 'c1', folderId: 'f2' })).toBe(false)
    expect(inScope({ company_id: 'c1', folder_id: null }, { companyId: 'c1', folderId: 'f1' })).toBe(false)
  })
})

describe('matchesDue', () => {
  const over = makeTask({ due_date: '2026-11-05' })
  const today = makeTask({ due_date: TODAY })
  const in7 = makeTask({ due_date: '2026-11-13' })
  const in8 = makeTask({ due_date: '2026-11-14' })
  const doing = makeTask({ due_date: '2026-11-20', status: 'doing' })
  const doneToday = makeTask({ due_date: TODAY, status: 'done' })
  const donePast = makeTask({ due_date: '2026-11-01', status: 'done' })

  it('over', () => {
    expect(matchesDue(over, 'over', TODAY)).toBe(true)
    expect(matchesDue(today, 'over', TODAY)).toBe(false)
    expect(matchesDue(donePast, 'over', TODAY)).toBe(false)
  })

  it('today: open tasks due today', () => {
    expect(matchesDue(today, 'today', TODAY)).toBe(true)
    expect(matchesDue(doneToday, 'today', TODAY)).toBe(false)
    expect(matchesDue(over, 'today', TODAY)).toBe(false)
  })

  it('week: open tasks from today to today+7 inclusive', () => {
    expect(matchesDue(today, 'week', TODAY)).toBe(true)
    expect(matchesDue(in7, 'week', TODAY)).toBe(true)
    expect(matchesDue(in8, 'week', TODAY)).toBe(false)
    expect(matchesDue(over, 'week', TODAY)).toBe(false)
    expect(matchesDue(doneToday, 'week', TODAY)).toBe(false)
  })

  it('doing: status only, regardless of date', () => {
    expect(matchesDue(doing, 'doing', TODAY)).toBe(true)
    expect(matchesDue(today, 'doing', TODAY)).toBe(false)
  })
})

describe('filterTasks', () => {
  const companies: Record<string, string> = { c1: 'Pasta Monesi', c2: 'Belelli' }
  const folders: Record<string, string> = { f1: 'Social novembre', f2: 'Video' }
  const ctx: FilterContext = {
    today: TODAY,
    companyName: (id) => companies[id] ?? '',
    folderName: (id) => (id ? (folders[id] ?? '') : ''),
  }

  const a = makeTask({ id: 'a', title: 'Carosello formati', company_id: 'c1', folder_id: 'f1', priority: 2 })
  const b = makeTask({
    id: 'b',
    title: 'Reel',
    notes: 'Montaggio con SOTTOTITOLI',
    company_id: 'c2',
    folder_id: 'f2',
    priority: 1,
    due_date: '2026-11-05',
  })
  const c = makeTask({
    id: 'c',
    title: 'Brochure',
    company_id: 'c2',
    folder_id: null,
    priority: 2,
    status: 'done',
  })
  const d = makeTask({
    id: 'd',
    title: 'Locandina',
    company_id: 'c1',
    folder_id: null,
    priority: 3,
    status: 'doing',
    due_date: '2026-11-10',
  })
  const all = [a, b, c, d]
  const ids = (ts: { id: string }[]) => ts.map((t) => t.id)

  it('no filters + showDone returns everything in order', () => {
    expect(ids(filterTasks(all, { showDone: true }, ctx))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('showDone=false hides done tasks', () => {
    expect(ids(filterTasks(all, { showDone: false }, ctx))).toEqual(['a', 'b', 'd'])
  })

  it('searches title, notes, company name and folder name (case-insensitive, trimmed)', () => {
    expect(ids(filterTasks(all, { q: 'carosello', showDone: true }, ctx))).toEqual(['a'])
    expect(ids(filterTasks(all, { q: 'sottotitoli', showDone: true }, ctx))).toEqual(['b'])
    expect(ids(filterTasks(all, { q: '  MONESI ', showDone: true }, ctx))).toEqual(['a', 'd'])
    expect(ids(filterTasks(all, { q: 'video', showDone: true }, ctx))).toEqual(['b'])
    expect(ids(filterTasks(all, { q: 'belelli', showDone: false }, ctx))).toEqual(['b'])
    expect(filterTasks(all, { q: 'nessuna corrispondenza', showDone: true }, ctx)).toEqual([])
  })

  it('blank search is ignored', () => {
    expect(filterTasks(all, { q: '   ', showDone: true }, ctx)).toHaveLength(4)
  })

  it('filters by priority', () => {
    expect(ids(filterTasks(all, { prio: 2, showDone: true }, ctx))).toEqual(['a', 'c'])
    expect(ids(filterTasks(all, { prio: 2, showDone: false }, ctx))).toEqual(['a'])
    expect(filterTasks(all, { prio: 0, showDone: true }, ctx)).toHaveLength(4)
  })

  it('applies the due filter unless ignoreDue', () => {
    expect(ids(filterTasks(all, { due: 'over', showDone: true }, ctx))).toEqual(['b'])
    expect(ids(filterTasks(all, { due: 'doing', showDone: true }, ctx))).toEqual(['d'])
    expect(ids(filterTasks(all, { due: 'today', showDone: true }, ctx))).toEqual(['a'])
    expect(filterTasks(all, { due: 'over', showDone: true }, { ...ctx, ignoreDue: true })).toHaveLength(4)
  })

  it('combines filters', () => {
    expect(ids(filterTasks(all, { q: 'monesi', prio: 3, due: 'week', showDone: false }, ctx))).toEqual(['d'])
  })
})

describe('compareTasks / sortTasks', () => {
  it('open tasks come before done ones', () => {
    const done = makeTask({ id: 'done', status: 'done', priority: 1 })
    const open = makeTask({ id: 'open', priority: 5 })
    expect(sortTasks([done, open]).map((t) => t.id)).toEqual(['open', 'done'])
  })

  it('then by priority, due date, due time and creation', () => {
    const p2late = makeTask({ id: 'p2late', priority: 2, due_date: '2026-11-20' })
    const p2early = makeTask({ id: 'p2early', priority: 2, due_date: '2026-11-07' })
    const p1 = makeTask({ id: 'p1', priority: 1, due_date: '2026-12-31' })
    const p3at10 = makeTask({ id: 'p3at10', priority: 3, due_date: TODAY, due_time: '10:00' })
    const p3at09 = makeTask({ id: 'p3at09', priority: 3, due_date: TODAY, due_time: '09:00' })
    const p3newer = makeTask({
      id: 'p3newer',
      priority: 3,
      due_date: '2026-11-08',
      created_at: '2026-11-02T00:00:00.000Z',
    })
    const p3older = makeTask({
      id: 'p3older',
      priority: 3,
      due_date: '2026-11-08',
      created_at: '2026-11-01T00:00:00.000Z',
    })
    const sorted = sortTasks([p3newer, p2late, p3at10, p1, p3older, p2early, p3at09])
    expect(sorted.map((t) => t.id)).toEqual([
      'p1',
      'p2early',
      'p2late',
      'p3at09',
      'p3at10',
      'p3older',
      'p3newer',
    ])
  })

  it('tasks without a due date sort after dated ones', () => {
    const nodate = makeTask({ id: 'nodate', due_date: '' })
    const dated = makeTask({ id: 'dated', due_date: '2099-01-01' })
    expect(sortTasks([nodate, dated]).map((t) => t.id)).toEqual(['dated', 'nodate'])
  })

  it('current behaviour: on the same day an untimed task sorts before timed ones', () => {
    const untimed = makeTask({ id: 'untimed', due_date: TODAY, due_time: null })
    const timed = makeTask({ id: 'timed', due_date: TODAY, due_time: '08:00' })
    expect(sortTasks([timed, untimed]).map((t) => t.id)).toEqual(['untimed', 'timed'])
  })

  it('sortTasks does not mutate the input', () => {
    const input = [makeTask({ priority: 5 }), makeTask({ priority: 1 })]
    const copy = [...input]
    sortTasks(input)
    expect(input).toEqual(copy)
  })

  it('compareTasks is 0 for equivalent tasks', () => {
    expect(compareTasks(makeTask({ id: 'x' }), makeTask({ id: 'y' }))).toBe(0)
  })
})

describe('compareByTime', () => {
  it('orders by time with untimed tasks last, then the standard order', () => {
    const untimedP1 = makeTask({ id: 'untimedP1', priority: 1 })
    const at15 = makeTask({ id: 'at15', priority: 5, due_time: '15:00' })
    const at09 = makeTask({ id: 'at09', priority: 4, due_time: '09:00' })
    const untimedP2 = makeTask({ id: 'untimedP2', priority: 2 })
    const sorted = [untimedP2, at15, untimedP1, at09].sort(compareByTime)
    expect(sorted.map((t) => t.id)).toEqual(['at09', 'at15', 'untimedP1', 'untimedP2'])
  })
})

describe('summaryCounts', () => {
  it('counts each tile independently', () => {
    const tasks = [
      makeTask({ due_date: '2026-11-01' }), // over
      makeTask({ due_date: '2026-11-04', status: 'doing' }), // over + doing
      makeTask({ due_date: TODAY }), // today + week
      makeTask({ due_date: TODAY, status: 'doing' }), // today + week + doing
      makeTask({ due_date: '2026-11-13' }), // week
      makeTask({ due_date: '2026-11-30' }), // niente
      makeTask({ due_date: '2026-11-01', status: 'done' }), // niente
      makeTask({ due_date: TODAY, status: 'done' }), // niente
    ]
    expect(summaryCounts(tasks, TODAY)).toEqual({ over: 2, today: 2, week: 3, doing: 2 })
  })

  it('all zeros for an empty list', () => {
    expect(summaryCounts([], TODAY)).toEqual({ over: 0, today: 0, week: 0, doing: 0 })
  })
})

describe('sumEstimate', () => {
  it('sums estimate_min, treating missing values as 0', () => {
    expect(
      sumEstimate([
        makeTask({ estimate_min: 30 }),
        makeTask({ estimate_min: 45 }),
        makeTask({ estimate_min: 0 }),
      ]),
    ).toBe(75)
    expect(sumEstimate([])).toBe(0)
  })
})
