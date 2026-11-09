import { makeLink } from '@/test/factories'
import { ancestorsOf, descendantsOf, indexLinks, linkKey, wouldCreateCycle } from './cycles'

const sorted = (s: Set<string>) => [...s].sort()

describe('indexLinks', () => {
  it('builds children and parents maps', () => {
    const idx = indexLinks([makeLink('a', 'b'), makeLink('a', 'c'), makeLink('d', 'b')])
    expect(idx.children.get('a')).toEqual(['b', 'c'])
    expect(idx.children.get('d')).toEqual(['b'])
    expect(idx.parents.get('b')).toEqual(['a', 'd'])
    expect(idx.parents.get('c')).toEqual(['a'])
    expect(idx.children.has('b')).toBe(false)
    expect(idx.parents.has('a')).toBe(false)
  })

  it('empty input', () => {
    const idx = indexLinks([])
    expect(idx.children.size).toBe(0)
    expect(idx.parents.size).toBe(0)
  })
})

describe('ancestorsOf / descendantsOf', () => {
  // a → b → c → d, a → e, x → c
  const idx = indexLinks([
    makeLink('a', 'b'),
    makeLink('b', 'c'),
    makeLink('c', 'd'),
    makeLink('a', 'e'),
    makeLink('x', 'c'),
  ])

  it('descendants at any depth, excluding the start node', () => {
    expect(sorted(descendantsOf('a', idx))).toEqual(['b', 'c', 'd', 'e'])
    expect(sorted(descendantsOf('c', idx))).toEqual(['d'])
    expect(sorted(descendantsOf('d', idx))).toEqual([])
    expect(sorted(descendantsOf('unknown', idx))).toEqual([])
  })

  it('ancestors at any depth', () => {
    expect(sorted(ancestorsOf('d', idx))).toEqual(['a', 'b', 'c', 'x'])
    expect(sorted(ancestorsOf('e', idx))).toEqual(['a'])
    expect(sorted(ancestorsOf('a', idx))).toEqual([])
  })

  it('terminates on cyclic data (defensive)', () => {
    const cyclic = indexLinks([makeLink('a', 'b'), makeLink('b', 'a')])
    expect(sorted(descendantsOf('a', cyclic))).toEqual(['a', 'b'])
  })
})

describe('wouldCreateCycle', () => {
  const idx = indexLinks([makeLink('a', 'b'), makeLink('b', 'c')])

  it('self link', () => {
    expect(wouldCreateCycle('a', 'a', indexLinks([]))).toBe(true)
  })

  it('direct cycle', () => {
    expect(wouldCreateCycle('b', 'a', idx)).toBe(true)
  })

  it('indirect cycle', () => {
    expect(wouldCreateCycle('c', 'a', idx)).toBe(true)
  })

  it('valid links', () => {
    expect(wouldCreateCycle('a', 'c', idx)).toBe(false) // scorciatoia: non è un ciclo
    expect(wouldCreateCycle('c', 'd', idx)).toBe(false)
    expect(wouldCreateCycle('d', 'a', idx)).toBe(false)
  })

  it('diamond shapes are allowed', () => {
    const diamond = indexLinks([makeLink('a', 'b'), makeLink('a', 'c'), makeLink('b', 'd')])
    expect(wouldCreateCycle('c', 'd', diamond)).toBe(false)
    expect(wouldCreateCycle('d', 'a', diamond)).toBe(true)
  })
})

describe('linkKey', () => {
  it('parent:child', () => {
    expect(linkKey({ parent_id: 'p', child_id: 'c' })).toBe('p:c')
  })
})
