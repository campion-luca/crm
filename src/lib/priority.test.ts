import { isTaskStatus, prio, PRIOS, STATI, statusDef, toPriority } from './priority'

describe('toPriority', () => {
  it('keeps valid priorities (numbers and numeric strings)', () => {
    for (const p of [1, 2, 3, 4, 5]) {
      expect(toPriority(p)).toBe(p)
      expect(toPriority(String(p))).toBe(p)
    }
  })

  it('rounds fractional values', () => {
    expect(toPriority(1.4)).toBe(1)
    expect(toPriority(0.6)).toBe(1)
    expect(toPriority(4.5)).toBe(5)
    expect(toPriority(5.4)).toBe(5)
  })

  it('falls back to 3 for out-of-range or non-numeric values', () => {
    for (const v of [0, -1, 6, 5.5, 100, NaN, Infinity, 'alta', '', null, undefined, {}, []]) {
      expect(toPriority(v)).toBe(3)
    }
  })
})

describe('prio', () => {
  it('returns the definition for each priority', () => {
    expect(prio(1)).toMatchObject({ id: 1, label: 'P1', name: 'Massima' })
    expect(prio(5)).toMatchObject({ id: 5, label: 'P5', name: 'Minima' })
    PRIOS.forEach((p) => expect(prio(p.id)).toBe(p))
  })

  it('falls back to P3 for invalid values', () => {
    expect(prio(0).id).toBe(3)
    expect(prio(9).id).toBe(3)
  })
})

describe('statusDef / isTaskStatus', () => {
  it('finds each status', () => {
    expect(statusDef('todo').label).toBe('Da fare')
    expect(statusDef('doing').label).toBe('In corso')
    expect(statusDef('review').label).toBe('In revisione')
    expect(statusDef('done').label).toBe('Fatto')
  })

  it('unknown status → "Da fare"', () => {
    expect(statusDef('boh')).toBe(STATI[0])
  })

  it('isTaskStatus', () => {
    for (const s of ['todo', 'doing', 'review', 'done']) expect(isTaskStatus(s)).toBe(true)
    for (const s of ['Done', 'fatto', '', null, undefined, 1]) expect(isTaskStatus(s)).toBe(false)
  })
})
