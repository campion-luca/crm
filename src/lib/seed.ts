import { addDaysISO } from './dates'
import { newId } from './format'
import { emptyBrand, type BrandColor, type BrandFont, type CompanyBrand } from './brand'
import { emptyProfile } from './profile'
import type { ChecklistItem, Company, Folder, Priority, Snapshot, Task, TaskLink, TaskStatus } from './types'

interface SeedOptions {
  /** posizione da cui numerare le aziende (per aggiungerle in coda a quelle esistenti) */
  basePosition?: number
  makeId?: () => string
}

/**
 * Dati di esempio "Carica esempi". Le date sono relative al giorno in cui si caricano.
 * user_id resta vuoto: lo imposta il server (auth.uid()) o il gateway locale.
 */
export function buildSeed(today: string, now: Date = new Date(), opts: SeedOptions = {}): Snapshot {
  const id = opts.makeId ?? newId
  const base = opts.basePosition ?? 0
  let tick = 0
  const stamp = () => new Date(now.getTime() + tick++).toISOString()
  const d = (n: number) => addDaysISO(today, n)

  const company = (name: string, color: string, i: number, brand = emptyBrand()): Company => ({
    id: id(),
    user_id: '',
    name,
    color,
    position: base + i,
    profile: emptyProfile(),
    brand,
    created_at: stamp(),
  })
  // setup aziendale di esempio: palette, font (Google Fonts) e tono di voce, senza file
  const col = (name: string, hex: string, role: BrandColor['role'], note?: string): BrandColor => ({
    id: id(),
    name,
    hex,
    role,
    note,
  })
  const font = (family: string, role: BrandFont['role'], weights: string): BrandFont => ({
    id: id(),
    family,
    role,
    weights,
    url: `https://fonts.google.com/specimen/${family.replace(/ /g, '+')}`,
    files: [],
  })
  const brand = (b: Partial<CompanyBrand>): CompanyBrand => ({ ...emptyBrand(), ...b })
  const folder = (c: Company, name: string, position: number): Folder => ({
    id: id(),
    user_id: '',
    company_id: c.id,
    name,
    position,
    created_at: stamp(),
  })
  const cl = (...items: [string, boolean][]): ChecklistItem[] =>
    items.map(([text, done]) => ({ id: id(), text, done }))

  interface TaskSeed {
    title: string
    folder: Folder
    priority: Priority
    due: number
    status?: TaskStatus
    time?: string
    estimate?: number
    notes?: string
    checklist?: ChecklistItem[]
    completedAt?: Date
  }
  const task = (s: TaskSeed): Task => {
    const status = s.status ?? 'todo'
    return {
      id: id(),
      user_id: '',
      company_id: s.folder.company_id,
      folder_id: s.folder.id,
      title: s.title,
      notes: s.notes ?? '',
      link: '',
      priority: s.priority,
      status,
      due_date: d(s.due),
      due_time: s.time ?? null,
      estimate_min: s.estimate ?? 0,
      checklist: s.checklist ?? [],
      completed_at: status === 'done' ? (s.completedAt ?? now).toISOString() : null,
      created_at: stamp(),
      updated_at: now.toISOString(),
    }
  }

  const monesi = company(
    'Pasta Monesi',
    '#ffe08a',
    0,
    brand({
      colors: [
        col('Giallo semola', '#ffe08a', 'primary', 'Pantone 7403 C'),
        col('Rosso pomodoro', '#c8402a', 'accent'),
        col('Farina', '#fbf6ea', 'neutral'),
        col('Antracite', '#2b2a28', 'neutral'),
      ],
      fonts: [font('Playfair Display', 'heading', 'Regular, Bold'), font('Lato', 'body', 'Regular, Bold')],
      payoff: 'La pasta fresca di casa, ogni giorno',
      tone: 'Caldo e familiare, mai pomposo. Diamo del tu, frasi brevi, niente inglesismi.',
      hashtags: '#pastamonesi #pastafresca #fattoamano',
      guidelines: 'Logo sempre su fondo chiaro. Foto con luce naturale, niente filtri saturi.',
    }),
  )
  const belelli = company(
    'Belelli',
    '#12b76a',
    1,
    brand({
      colors: [col('Verde Belelli', '#12b76a', 'primary'), col('Notte', '#14213d', 'secondary')],
      fonts: [font('Montserrat', 'heading', 'SemiBold, ExtraBold'), font('Open Sans', 'body', 'Regular')],
      payoff: 'Muoviti meglio',
    }),
  )
  const hybrix = company(
    'Hybrix',
    '#1d3fae',
    2,
    brand({
      colors: [col('Blu Hybrix', '#1d3fae', 'primary'), col('Ghiaccio', '#e8eefc', 'neutral')],
      fonts: [font('Inter', 'body', 'Regular, Medium, Bold')],
    }),
  )

  const social = folder(monesi, 'Social novembre', 0)
  const ecommerce = folder(monesi, 'Sito e-commerce', 1)
  const campagna = folder(belelli, 'Campagna', 0)
  const video = folder(belelli, 'Video', 1)
  const lancio = folder(hybrix, 'Lancio', 0)
  const stampa = folder(hybrix, 'Materiale stampa', 1)

  const hour = 36e5
  const call = task({
    title: 'Call con il cliente per promo gennaio',
    folder: campagna,
    priority: 3,
    due: 4,
    time: '15:30',
    estimate: 30,
  })
  const slide = task({
    title: 'Preparare slide della proposta promo',
    folder: campagna,
    priority: 2,
    due: 3,
    status: 'doing',
    estimate: 60,
  })
  const meet = task({
    title: 'Inviare invito Google Meet',
    folder: campagna,
    priority: 3,
    due: 1,
    status: 'done',
    estimate: 5,
    completedAt: new Date(now.getTime() - hour),
  })
  const loghi = task({
    title: 'Raccogliere loghi partner in alta risoluzione',
    folder: campagna,
    priority: 4,
    due: 2,
    estimate: 15,
  })

  const tasks: Task[] = [
    task({
      title: 'Piano editoriale settimana prossima',
      folder: social,
      priority: 2,
      due: 0,
      status: 'doing',
      estimate: 60,
      checklist: cl(['Bozza 5 post', true], ['Approvazione cliente', false]),
    }),
    task({ title: 'Carosello formati di pasta', folder: social, priority: 3, due: 2, estimate: 90 }),
    task({
      title: 'Aggiornare spedizioni festive nel footer',
      folder: ecommerce,
      priority: 1,
      due: -1,
      estimate: 20,
    }),
    task({ title: 'Ottimizzare immagini prodotti', folder: ecommerce, priority: 5, due: 8, estimate: 45 }),
    task({
      title: 'Locandina evento',
      folder: campagna,
      priority: 1,
      due: 1,
      time: '12:00',
      status: 'review',
      estimate: 120,
      notes: 'Formato A3 + versione stories 1080×1920',
    }),
    task({
      title: 'Reel presentazione prodotto',
      folder: video,
      priority: 2,
      due: 3,
      estimate: 180,
      checklist: cl(['Riprese', false], ['Montaggio + sottotitoli', false]),
    }),
    call,
    slide,
    meet,
    loghi,
    task({ title: 'Brochure prodotti', folder: stampa, priority: 2, due: 6, status: 'doing', estimate: 150 }),
    task({ title: 'Video di lancio', folder: lancio, priority: 3, due: 9, estimate: 240 }),
    task({
      title: 'Post annuncio lancio',
      folder: lancio,
      priority: 3,
      due: -3,
      status: 'done',
      estimate: 40,
      completedAt: new Date(now.getTime() - 3 * 24 * hour + 5 * hour),
    }),
    task({ title: 'Comunicato stampa', folder: stampa, priority: 2, due: 12, estimate: 60 }),
  ]

  const links: TaskLink[] = [slide, meet, loghi].map((c) => ({
    parent_id: call.id,
    child_id: c.id,
    user_id: '',
  }))

  return {
    companies: [monesi, belelli, hybrix],
    folders: [social, ecommerce, campagna, video, lancio, stampa],
    tasks,
    links,
  }
}
