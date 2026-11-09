import { byIdMap, makeFolder, makeLink, makeTask } from '@/test/factories'
import { indexLinks } from './cycles'
import { checklistProgress, childrenOf, companyStats, linkProgress, openParents, readyParents } from './stats'

const TODAY = '2026-11-06'

describe('companyStats', () => {
  const folders = [makeFolder({ id: 'f1' })]

  it('counts open/done/over/today/week, estimate of open tasks and percentage', () => {
    const tasks = [
      makeTask({ id: 'over', due_date: '2026-11-01', estimate_min: 10 }),
      makeTask({ id: 'today', due_date: TODAY, estimate_min: 20 }),
      makeTask({ id: 'in7', due_date: '2026-11-13', estimate_min: 30 }),
      makeTask({ id: 'in20', due_date: '2026-11-26', estimate_min: 40 }),
      makeTask({ id: 'done1', due_date: TODAY, status: 'done', estimate_min: 100 }),
      makeTask({ id: 'done2', due_date: '2026-11-01', status: 'done', estimate_min: 100 }),
    ]
    const s = companyStats(tasks, folders, TODAY)
    expect(s.total).toBe(6)
    expect(s.open.map((t) => t.id)).toEqual(['over', 'today', 'in7', 'in20'])
    expect(s.done).toBe(2)
    expect(s.over).toBe(1)
    expect(s.today).toBe(1)
    expect(s.week).toBe(2)
    expect(s.estMin).toBe(100)
    expect(s.pct).toBe(33)
    expect(s.folders).toBe(folders)
  })

  it('empty company: pct 0 and no next task', () => {
    const s = companyStats([], folders, TODAY)
    expect(s).toMatchObject({
      total: 0,
      done: 0,
      over: 0,
      today: 0,
      week: 0,
      estMin: 0,
      pct: 0,
      next: undefined,
    })
  })

  it('all done → 100%', () => {
    expect(companyStats([makeTask({ status: 'done' })], [], TODAY).pct).toBe(100)
  })

  it('next = earliest open task due today or later, by date then time (untimed last)', () => {
    const tasks = [
      makeTask({ id: 'past', due_date: '2026-11-05' }),
      makeTask({ id: 'doneToday', due_date: TODAY, due_time: '08:00', status: 'done' }),
      makeTask({ id: 'tomorrow', due_date: '2026-11-07', due_time: '09:00' }),
      makeTask({ id: 'todayUntimed', due_date: TODAY }),
      makeTask({ id: 'today14', due_date: TODAY, due_time: '14:00' }),
    ]
    expect(companyStats(tasks, [], TODAY).next?.id).toBe('today14')
    expect(
      companyStats(
        tasks.filter((t) => t.id !== 'today14'),
        [],
        TODAY,
      ).next?.id,
    ).toBe('todayUntimed')
    expect(companyStats([tasks[0]!], [], TODAY).next).toBeUndefined()
  })

  it('does not reorder the input', () => {
    const tasks = [makeTask({ id: 'b', due_date: '2026-11-09' }), makeTask({ id: 'a', due_date: TODAY })]
    companyStats(tasks, [], TODAY)
    expect(tasks.map((t) => t.id)).toEqual(['b', 'a'])
  })
})

describe('link helpers', () => {
  // p1 → a, b, c ; p2 → a ; pDone → a
  const tasks = [
    makeTask({ id: 'p1' }),
    makeTask({ id: 'p2' }),
    makeTask({ id: 'pDone', status: 'done' }),
    makeTask({ id: 'a', status: 'done' }),
    makeTask({ id: 'b', status: 'done' }),
    makeTask({ id: 'c' }),
    makeTask({ id: 'lonely' }),
  ]
  const byId = byIdMap(tasks)
  const idx = indexLinks([
    makeLink('p1', 'a'),
    makeLink('p1', 'b'),
    makeLink('p1', 'c'),
    makeLink('p1', 'ghost'),
    makeLink('p2', 'a'),
    makeLink('pDone', 'a'),
  ])

  it('linkProgress counts done children, ignoring missing tasks', () => {
    expect(linkProgress('p1', idx, byId)).toEqual({ done: 2, total: 3 })
    expect(linkProgress('p2', idx, byId)).toEqual({ done: 1, total: 1 })
    expect(linkProgress('lonely', idx, byId)).toBeNull()
  })

  it('childrenOf returns existing child tasks in link order', () => {
    expect(childrenOf('p1', idx, byId).map((t) => t.id)).toEqual(['a', 'b', 'c'])
    expect(childrenOf('lonely', idx, byId)).toEqual([])
  })

  it('openParents excludes done parents', () => {
    expect(openParents('a', idx, byId).map((t) => t.id)).toEqual(['p1', 'p2'])
    expect(openParents('lonely', idx, byId)).toEqual([])
  })

  it('readyParents: open parents whose children are all done', () => {
    expect(readyParents('a', idx, byId).map((t) => t.id)).toEqual(['p2'])
    const afterC = new Map(byId)
    afterC.set('c', { ...byId.get('c')!, status: 'done' })
    expect(readyParents('c', idx, afterC).map((t) => t.id)).toEqual(['p1'])
    expect(readyParents('a', idx, afterC).map((t) => t.id)).toEqual(['p1', 'p2'])
  })
})

describe('checklistProgress', () => {
  it('null for an empty checklist', () => {
    expect(checklistProgress({ checklist: [] })).toBeNull()
  })

  it('counts done items', () => {
    expect(
      checklistProgress({
        checklist: [
          { id: '1', text: 'a', done: true },
          { id: '2', text: 'b', done: false },
          { id: '3', text: 'c', done: true },
        ],
      }),
    ).toEqual({ done: 2, total: 3 })
  })
})
