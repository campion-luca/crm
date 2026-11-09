import { cn, fmtEst, fmtHours, newId } from './format'

describe('fmtEst', () => {
  it.each([
    [0, ''],
    [null, ''],
    [undefined, ''],
    [-30, ''],
    [0.4, ''],
    [1, '1 min'],
    [45, '45 min'],
    [59, '59 min'],
    [59.6, '1 h'],
    [60, '1 h'],
    [90, '1,5 h'],
    [100, '1,7 h'],
    [120, '2 h'],
    [150, '2,5 h'],
    [240, '4 h'],
  ])('%s → %j', (min, expected) => {
    expect(fmtEst(min)).toBe(expected)
  })
})

describe('fmtHours', () => {
  it.each([
    [8, '8 h'],
    [2.5, '2,5 h'],
    [0, '0 h'],
    [7.25, '7,3 h'],
    [1.04, '1 h'],
    [0.5, '0,5 h'],
  ])('%s → %j', (h, expected) => {
    expect(fmtHours(h)).toBe(expected)
  })
})

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
    expect(cn()).toBe('')
  })
})

describe('newId', () => {
  it('returns distinct UUIDs', () => {
    const a = newId()
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
    expect(newId()).not.toBe(a)
  })
})
