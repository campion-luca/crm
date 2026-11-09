import {
  emptyProfile,
  initials,
  isHex,
  isProfileEmpty,
  normUrl,
  parseProfile,
  quickLinks,
  socialUrl,
  type CompanyProfile,
} from './profile'

const profile = (p: Partial<CompanyProfile> = {}): CompanyProfile => ({ ...emptyProfile(), ...p })

describe('parseProfile', () => {
  it('returns an empty profile for null, undefined and non-objects', () => {
    for (const raw of [null, undefined, 'testo', 42, true, []]) {
      expect(parseProfile(raw)).toEqual(emptyProfile())
    }
  })

  it('keeps a valid profile', () => {
    const raw = {
      contacts: [{ name: 'Mario Rossi', role: 'Marketing', email: 'mario@example.com', phone: '+39 333' }],
      website: 'pastamonesi.it',
      links: [{ label: 'Drive', url: 'https://drive.example.com' }],
      social: { instagram: '@pastamonesi', linkedin: 'pasta-monesi' },
      brandColors: ['#ffe08a', '#000000'],
      fonts: 'Inter',
      address: 'Via Roma 1, Imola',
      vat: 'IT01234567890',
      notes: 'Cliente storico',
    }
    expect(parseProfile(raw)).toEqual(raw)
  })

  it('trims optional text fields', () => {
    expect(parseProfile({ website: '  example.com  ', notes: '  ciao ' })).toMatchObject({
      website: 'example.com',
      notes: 'ciao',
    })
  })

  it('malformed fields become empty without discarding the rest', () => {
    const p = parseProfile({
      contacts: 'non una lista',
      website: 123,
      links: { url: 'x' },
      social: { instagram: 5 },
      brandColors: 'rosso',
      fonts: ['Inter'],
      address: 'Via Roma 1',
    })
    expect(p).toEqual({
      contacts: [],
      links: [],
      social: {},
      brandColors: [],
      address: 'Via Roma 1',
    })
    expect(p.website).toBeUndefined()
    expect(p.fonts).toBeUndefined()
  })

  it('malformed nested values fall back field by field', () => {
    const p = parseProfile({
      contacts: [{ name: 7, email: 'a@b.it', role: false }],
      links: [{ label: null, url: 'example.com' }],
    })
    expect(p.contacts).toEqual([{ name: '', email: 'a@b.it' }])
    expect(p.links).toEqual([{ label: '', url: 'example.com' }])
  })

  it('drops unknown keys', () => {
    expect(parseProfile({ foo: 'bar', website: 'x.it' })).toEqual({ ...emptyProfile(), website: 'x.it' })
  })

  it('never throws', () => {
    const weird: unknown[] = [
      Symbol('x'),
      () => 1,
      new Date(),
      { contacts: [null, 1, 'x'] },
      { social: null },
    ]
    for (const raw of weird) expect(() => parseProfile(raw)).not.toThrow()
  })
})

describe('isProfileEmpty', () => {
  it('true for an empty profile', () => {
    expect(isProfileEmpty(emptyProfile())).toBe(true)
    expect(isProfileEmpty(parseProfile({}))).toBe(true)
  })

  it('social with only empty values counts as empty', () => {
    expect(isProfileEmpty(profile({ social: { instagram: '' } }))).toBe(true)
  })

  it('legacy brand fields alone count as empty (they live in the Setup aziendale now)', () => {
    expect(isProfileEmpty(profile({ brandColors: ['#fff000'], fonts: 'Inter' }))).toBe(true)
  })

  it.each<[string, Partial<CompanyProfile>]>([
    ['contacts', { contacts: [{ name: 'Mario' }] }],
    ['website', { website: 'x.it' }],
    ['links', { links: [{ label: '', url: '' }] }],
    ['social', { social: { tiktok: '@x' } }],
    ['address', { address: 'Via' }],
    ['vat', { vat: 'IT1' }],
    ['notes', { notes: 'n' }],
  ])('false when %s is set', (_name, p) => {
    expect(isProfileEmpty(profile(p))).toBe(false)
  })
})

describe('normUrl', () => {
  it('adds https:// when missing', () => {
    expect(normUrl('example.com')).toBe('https://example.com')
    expect(normUrl('  example.com/path ')).toBe('https://example.com/path')
  })

  it('keeps http(s) URLs', () => {
    expect(normUrl('http://example.com')).toBe('http://example.com')
    expect(normUrl('HTTPS://Example.com')).toBe('HTTPS://Example.com')
  })

  it('empty → empty', () => {
    expect(normUrl('')).toBe('')
    expect(normUrl('   ')).toBe('')
    expect(normUrl(undefined)).toBe('')
  })
})

describe('socialUrl', () => {
  it('turns a handle into the full URL', () => {
    expect(socialUrl('instagram', '@pastamonesi')).toBe('https://instagram.com/pastamonesi')
    expect(socialUrl('instagram', 'pastamonesi')).toBe('https://instagram.com/pastamonesi')
    expect(socialUrl('facebook', 'pastamonesi')).toBe('https://facebook.com/pastamonesi')
    expect(socialUrl('linkedin', 'pasta-monesi')).toBe('https://linkedin.com/company/pasta-monesi')
    expect(socialUrl('tiktok', '@pastamonesi')).toBe('https://tiktok.com/@pastamonesi')
    expect(socialUrl('youtube', '@pastamonesi')).toBe('https://youtube.com/@pastamonesi')
  })

  it('keeps full URLs', () => {
    expect(socialUrl('instagram', 'https://instagram.com/foo')).toBe('https://instagram.com/foo')
    expect(socialUrl('linkedin', 'http://linkedin.com/in/mario')).toBe('http://linkedin.com/in/mario')
  })

  it('URLs without protocol get https://', () => {
    expect(socialUrl('instagram', 'instagram.com/foo')).toBe('https://instagram.com/foo')
    expect(socialUrl('facebook', 'www.facebook.it/pagina')).toBe('https://www.facebook.it/pagina')
  })

  it('empty → empty', () => {
    expect(socialUrl('instagram', '')).toBe('')
    expect(socialUrl('instagram', '  ')).toBe('')
    expect(socialUrl('instagram', undefined)).toBe('')
  })
})

describe('quickLinks', () => {
  it('website first as "Sito", then links with a URL ("Link" as label fallback)', () => {
    const p = profile({
      website: 'pastamonesi.it',
      links: [
        { label: 'Drive', url: 'drive.google.com/x' },
        { label: 'Senza url', url: '' },
        { label: '', url: 'https://figma.com/file' },
      ],
    })
    expect(quickLinks(p)).toEqual([
      { label: 'Sito', url: 'https://pastamonesi.it' },
      { label: 'Drive', url: 'https://drive.google.com/x' },
      { label: 'Link', url: 'https://figma.com/file' },
    ])
  })

  it('no website → only links; empty profile → []', () => {
    expect(quickLinks(profile({ links: [{ label: 'A', url: 'a.it' }] }))).toEqual([
      { label: 'A', url: 'https://a.it' },
    ])
    expect(quickLinks(emptyProfile())).toEqual([])
  })
})

describe('initials', () => {
  it.each([
    ['Pasta Monesi', 'PM'],
    ['Belelli', 'B'],
    ['hybrix srl italia', 'HS'],
    ['  studio   rossi  ', 'SR'],
    ['Hybrix (vecchio nome) Lab', 'HL'],
    ['', ''],
  ])('%j → %j', (name, expected) => {
    expect(initials(name)).toBe(expected)
  })
})

describe('isHex', () => {
  it('accepts #rrggbb in any case', () => {
    expect(isHex('#ffe08a')).toBe(true)
    expect(isHex('#FFE08A')).toBe(true)
  })

  it('rejects other formats', () => {
    for (const v of ['#fff', 'ffe08a', '#ffe08a0', '#ggg000', 'red', '', ' #ffe08a'])
      expect(isHex(v)).toBe(false)
  })
})
