import { makeTask } from '@/test/factories'
import { DEADLINE_GROUPS, flattenGroups, groupDeadlines } from './group'

const TODAY = '2026-11-06'

const tasks = [
  makeTask({ id: 'over2', due_date: '2026-11-01' }),
  makeTask({ id: 'over1', due_date: '2026-11-05' }),
  makeTask({ id: 'overDone', due_date: '2026-11-04', status: 'done' }),
  makeTask({ id: 'today', due_date: TODAY }),
  makeTask({ id: 'todayDone', due_date: TODAY, status: 'done' }),
  makeTask({ id: 'tomorrow', due_date: '2026-11-07' }),
  makeTask({ id: 'week2', due_date: '2026-11-08' }),
  makeTask({ id: 'week7', due_date: '2026-11-13' }),
  makeTask({ id: 'later8', due_date: '2026-11-14' }),
  makeTask({ id: 'later14', due_date: '2026-11-20' }),
  makeTask({ id: 'later15', due_date: '2026-11-21' }),
  makeTask({ id: 'later60', due_date: '2027-01-05' }),
  makeTask({ id: 'nodate', due_date: '' }),
]

const summary = (groups: ReturnType<typeof groupDeadlines>) =>
  Object.fromEntries(groups.map((g) => [g.id, g.items.map((t) => t.id)]))

describe('groupDeadlines', () => {
  it('groups open tasks with a 14-day horizon', () => {
    const groups = groupDeadlines(tasks, TODAY, 14)
    expect(groups.map((g) => g.id)).toEqual(['over', 'today', 'tomorrow', 'week', 'later'])
    expect(summary(groups)).toEqual({
      over: ['over2', 'over1'],
      today: ['today'],
      tomorrow: ['tomorrow'],
      week: ['week2', 'week7'],
      later: ['later8', 'later14'],
    })
  })

  it('with a 7-day horizon there is no "later" group', () => {
    const groups = groupDeadlines(tasks, TODAY, 7)
    expect(groups.map((g) => g.id)).toEqual(['over', 'today', 'tomorrow', 'week'])
  })

  it('with a 60-day horizon "later" reaches today+60', () => {
    expect(summary(groupDeadlines(tasks, TODAY, 60)).later).toEqual([
      'later8',
      'later14',
      'later15',
      'later60',
    ])
    expect(summary(groupDeadlines(tasks, TODAY, 30)).later).toEqual(['later8', 'later14', 'later15'])
  })

  it('"all" has no limit and adds the "Senza scadenza" group', () => {
    const groups = groupDeadlines(tasks, TODAY, 'all')
    expect(groups.map((g) => g.id)).toEqual(['over', 'today', 'tomorrow', 'week', 'later', 'nodate'])
    expect(summary(groups).later).toEqual(['later8', 'later14', 'later15', 'later60'])
    expect(summary(groups).nodate).toEqual(['nodate'])
  })

  it('never includes done tasks', () => {
    const ids = groupDeadlines(tasks, TODAY, 'all').flatMap((g) => g.items.map((t) => t.id))
    expect(ids).not.toContain('overDone')
    expect(ids).not.toContain('todayDone')
    expect(ids).toHaveLength(tasks.length - 2)
  })

  it('returns only non-empty groups, in the fixed order, with label and color', () => {
    const groups = groupDeadlines(
      [makeTask({ id: 'x', due_date: '2026-11-07' }), makeTask({ due_date: '2026-11-01' })],
      TODAY,
      14,
    )
    expect(groups.map((g) => g.id)).toEqual(['over', 'tomorrow'])
    expect(groups[1]).toMatchObject({ label: 'Domani', color: DEADLINE_GROUPS[2]!.color })
    expect(groupDeadlines([], TODAY, 'all')).toEqual([])
  })

  it('sorts by date + time (untimed last), then priority', () => {
    const groups = groupDeadlines(
      [
        makeTask({ id: 'd9-p1', due_date: '2026-11-09', priority: 1 }),
        makeTask({ id: 'd8-untimed-p2', due_date: '2026-11-08', priority: 2 }),
        makeTask({ id: 'd8-untimed-p1', due_date: '2026-11-08', priority: 1 }),
        makeTask({ id: 'd8-1500', due_date: '2026-11-08', due_time: '15:00', priority: 5 }),
        makeTask({ id: 'd8-0900', due_date: '2026-11-08', due_time: '09:00', priority: 4 }),
      ],
      TODAY,
      14,
    )
    expect(summary(groups).week).toEqual(['d8-0900', 'd8-1500', 'd8-untimed-p1', 'd8-untimed-p2', 'd9-p1'])
  })

  it('does not mutate the input array', () => {
    const input = [
      makeTask({ id: 'b', due_date: '2026-11-09' }),
      makeTask({ id: 'a', due_date: '2026-11-08' }),
    ]
    groupDeadlines(input, TODAY, 14)
    expect(input.map((t) => t.id)).toEqual(['b', 'a'])
  })
})

describe('flattenGroups', () => {
  it('emits a header followed by its tasks, for each group', () => {
    const groups = groupDeadlines(tasks, TODAY, 7)
    const rows = flattenGroups(groups)
    expect(rows.map((r) => (r.kind === 'header' ? `#${r.group.id}` : r.task.id))).toEqual([
      '#over',
      'over2',
      'over1',
      '#today',
      'today',
      '#tomorrow',
      'tomorrow',
      '#week',
      'week2',
      'week7',
    ])
    for (const r of rows) if (r.kind === 'task') expect(r.group.items).toContain(r.task)
  })

  it('empty → []', () => {
    expect(flattenGroups([])).toEqual([])
  })
})
