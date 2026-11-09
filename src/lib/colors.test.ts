import { COMPANY_COLORS, nextCompanyColor, tint } from './colors'

describe('nextCompanyColor', () => {
  it('starts from the first palette color', () => {
    expect(nextCompanyColor([])).toBe(COMPANY_COLORS[0])
  })

  it('returns the first unused color, in palette order', () => {
    expect(nextCompanyColor(['#ffe08a'])).toBe('#12b76a')
    expect(nextCompanyColor(['#12b76a'])).toBe('#ffe08a')
    expect(nextCompanyColor(['#ffe08a', '#12b76a', '#ff5a5f'])).toBe('#1d3fae')
  })

  it('ignores colors outside the palette', () => {
    expect(nextCompanyColor(['#000000', '#123456'])).toBe('#ffe08a')
  })

  it('compares case-insensitively', () => {
    expect(nextCompanyColor(['#FFE08A', '#12B76A'])).toBe('#1d3fae')
  })

  it('wraps around when every color is used', () => {
    const all = [...COMPANY_COLORS]
    expect(nextCompanyColor(all)).toBe(COMPANY_COLORS[0])
    expect(nextCompanyColor([...all, '#ffe08a'])).toBe(COMPANY_COLORS[1])
  })
})

describe('tint', () => {
  it('builds a color-mix expression', () => {
    expect(tint('#ff0000', 16)).toBe('color-mix(in srgb, #ff0000 16%, transparent)')
    expect(tint('#ff0000', 28, 'white')).toBe('color-mix(in srgb, #ff0000 28%, white)')
  })
})
