import { describe, expect, it } from 'vitest'
import {
  brandCss,
  brandFilePaths,
  contrastRatio,
  emptyBrand,
  fmtBytes,
  fontFromFileName,
  googleFontsCss,
  isBrandEmpty,
  isGoogleFontsUrl,
  mimeOf,
  parseBrand,
  previewFile,
  rgbText,
  splitLegacyFonts,
  textOn,
  withoutFiles,
  type CompanyBrand,
} from './brand'
import { emptyProfile } from './profile'

const file = (path: string, name = 'logo.svg') => ({ path, name, mime: 'image/svg+xml', size: 2048 })

const full: CompanyBrand = {
  logos: [{ id: 'l1', label: 'Logo principale', file: file('u/c/1.svg'), bg: 'light', w: 300, h: 100 }],
  avatar: 'data:image/webp;base64,AAAA',
  avatarOf: 'l1',
  colors: [{ id: 'c1', name: 'Giallo', hex: '#ffe08a', role: 'primary', note: 'Pantone 1205 C' }],
  fonts: [
    {
      id: 'f1',
      family: 'Montserrat',
      role: 'heading',
      weights: 'Regular, Bold',
      url: undefined,
      files: [{ ...file('u/c/2.woff2', 'Montserrat-Bold.woff2'), style: 'Bold' }],
    },
  ],
  payoff: 'Fatto bene',
  tone: 'Diretto',
  hashtags: '#ciao',
  guidelines: 'Area di rispetto: 1x',
  docs: [
    { id: 'd1', label: 'Brand book', url: undefined, file: file('u/c/3.pdf', 'brand.pdf') },
    { id: 'd2', label: 'Figma', url: 'https://figma.com/x', file: undefined },
  ],
}

describe('parseBrand', () => {
  it('legge un setup completo così com’è', () => {
    expect(parseBrand(JSON.parse(JSON.stringify(full)))).toEqual(full)
  })

  it('valori non validi diventano vuoti senza rompere il resto', () => {
    expect(parseBrand(null)).toEqual(emptyBrand())
    expect(parseBrand('rosso')).toEqual(emptyBrand())
    const b = parseBrand({
      logos: 'nope',
      colors: [{ id: 'a', hex: '#FFFFFF', name: 'Bianco' }, { id: 'b', hex: 'rosso' }, 42],
      fonts: [
        { id: 'f', family: '  ' },
        { id: 'g', family: 'Lato', role: 'boh', files: [{ name: 'x' }] },
      ],
      docs: [{ id: 'd', label: 'Vuoto' }],
      payoff: '   ',
    })
    expect(b.logos).toEqual([])
    expect(b.colors).toEqual([{ id: 'a', name: 'Bianco', hex: '#ffffff', role: 'other', note: undefined }])
    expect(b.fonts).toEqual([
      { id: 'g', family: 'Lato', role: 'other', weights: undefined, url: undefined, files: [] },
    ])
    expect(b.docs).toEqual([])
    expect(b.payoff).toBeUndefined()
  })

  it('accetta come avatar solo immagini raster inline', () => {
    expect(parseBrand({ avatar: 'https://tracker.example/x.png', avatarOf: 'l1' }).avatar).toBeUndefined()
    expect(parseBrand({ avatar: 'data:image/svg+xml;base64,PHN2Zz4=' }).avatar).toBeUndefined()
    const ok = parseBrand({ avatar: 'data:image/png;base64,iVBORw0KGgo=', avatarOf: 'l1' })
    expect(ok.avatar).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(ok.avatarOf).toBe('l1')
  })

  it('setup mai salvato: recupera colori e font dalla scheda (formato precedente)', () => {
    const legacy = { ...emptyProfile(), brandColors: ['#FFE08A', 'rosso', '#000000'], fonts: 'Inter' }
    const b = parseBrand({}, legacy)
    expect(b.colors.map((c) => [c.id, c.hex, c.role])).toEqual([
      ['legacy-color-0', '#ffe08a', 'primary'],
      ['legacy-color-1', '#000000', 'other'],
    ])
    expect(b.fonts.map((f) => f.family)).toEqual(['Inter'])
    // una volta salvato, il setup vince anche se è vuoto
    expect(parseBrand({ colors: [] }, legacy).colors).toEqual([])
  })
})

describe('splitLegacyFonts', () => {
  it('usa le etichette per il ruolo', () => {
    expect(splitLegacyFonts('Titoli: Playfair Display · Testi: Lato').map((f) => [f.family, f.role])).toEqual(
      [
        ['Playfair Display', 'heading'],
        ['Lato', 'body'],
      ],
    )
  })
  it('senza etichette: titoli, testo, poi altro; niente doppioni', () => {
    expect(splitLegacyFonts('Montserrat, Open Sans e Inter / montserrat').map((f) => f.role)).toEqual([
      'heading',
      'body',
      'other',
    ])
    expect(splitLegacyFonts('  ')).toEqual([])
  })
})

describe('colori', () => {
  it('rgb e contrasto WCAG', () => {
    expect(rgbText('#ffe08a')).toBe('255, 224, 138')
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
  it('sceglie il testo più leggibile', () => {
    expect(textOn('#ffe08a')).toMatchObject({ ink: '#000000', level: 'AAA' })
    expect(textOn('#1d3fae')).toMatchObject({ ink: '#ffffff', level: 'AAA' })
    expect(textOn('#d64933').level).toBe('AA')
    expect(textOn('#777777').level).toBe('AA')
  })
})

describe('brandCss', () => {
  it('nomi da nome o ruolo, senza doppioni', () => {
    const css = brandCss({
      ...emptyBrand(),
      colors: [
        { id: 'a', name: 'Giallo Città', hex: '#ffe08a', role: 'primary', note: undefined },
        { id: 'b', name: '', hex: '#000000', role: 'neutral', note: undefined },
        { id: 'c', name: '', hex: '#111111', role: 'neutral', note: undefined },
      ],
      fonts: [
        { id: 'f', family: 'Lato', role: 'body', weights: undefined, url: undefined, files: [] },
        { id: 'g', family: 'JetBrains Mono', role: 'other', weights: undefined, url: undefined, files: [] },
      ],
    })
    expect(css).toBe(
      [
        ':root {',
        '  --color-giallo-citta: #ffe08a;',
        '  --color-neutro: #000000;',
        '  --color-neutro-2: #111111;',
        '  --font-testo: "Lato", sans-serif;',
        '  --font-altro: "JetBrains Mono", monospace;',
        '}',
      ].join('\n'),
    )
  })
})

describe('font dai nomi dei file', () => {
  it.each([
    ['OpenSans-BoldItalic.ttf', 'Open Sans', 'Bold Italic'],
    ['Montserrat-Regular.otf', 'Montserrat', 'Regular'],
    ['plus-jakarta-sans-latin-400-normal.woff2', 'Plus Jakarta Sans', 'Regular'],
    ['plus-jakarta-sans-latin-700-italic.woff2', 'Plus Jakarta Sans', 'Bold Italic'],
    ['Inter_18pt-SemiBold.ttf', 'Inter', 'SemiBold'],
    ['Lato.woff2', 'Lato', 'Regular'],
    ['Playfair Display Black.ttf', 'Playfair Display', 'Black'],
  ])('%s → %s · %s', (name, family, style) => {
    expect(fontFromFileName(name)).toEqual({ family, style })
  })

  it('anteprima con il Regular se presente', () => {
    const f = (style: string) => ({ ...file(style), style })
    expect(previewFile([f('Bold'), f('Regular')])?.style).toBe('Regular')
    expect(previewFile([f('Bold'), f('Black')])?.style).toBe('Bold')
    expect(previewFile([])).toBeUndefined()
  })
})

describe('file e utilità', () => {
  it('content type dei font e degli svg', () => {
    expect(mimeOf({ name: 'A.WOFF2', type: '' })).toBe('font/woff2')
    expect(mimeOf({ name: 'logo.svg', type: '' })).toBe('image/svg+xml')
    expect(mimeOf({ name: 'x.pdf', type: 'application/pdf' })).toBe('application/pdf')
    expect(mimeOf({ name: 'x', type: '' })).toBe('application/octet-stream')
  })
  it('dimensioni leggibili', () => {
    expect(fmtBytes(512)).toBe('512 B')
    expect(fmtBytes(24 * 1024)).toBe('24 KB')
    expect(fmtBytes(2.25 * 1024 * 1024)).toBe('2,3 MB')
  })
  it('Google Fonts', () => {
    expect(isGoogleFontsUrl('https://fonts.google.com/specimen/Lato')).toBe(true)
    expect(isGoogleFontsUrl('fonts.google.com/specimen/Lato')).toBe(true)
    expect(isGoogleFontsUrl('https://example.com/fonts.google.com/')).toBe(false)
    expect(googleFontsCss('Playfair Display')).toBe(
      'https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap',
    )
  })
  it('percorsi dei file, setup vuoto e backup senza file', () => {
    expect(brandFilePaths(full)).toEqual(['u/c/1.svg', 'u/c/2.woff2', 'u/c/3.pdf'])
    expect(isBrandEmpty(emptyBrand())).toBe(true)
    expect(isBrandEmpty({ ...emptyBrand(), payoff: 'x' })).toBe(false)
    const stripped = withoutFiles(full)
    expect(brandFilePaths(stripped)).toEqual([])
    expect(stripped.avatar).toBeUndefined()
    expect(stripped.docs.map((d) => d.label)).toEqual(['Figma'])
    expect(stripped.colors).toEqual(full.colors)
    expect(stripped.fonts[0]?.family).toBe('Montserrat')
  })
})
