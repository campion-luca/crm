import { applyChanges, type Change } from '@/data/changes'
import { COMPANY_COLORS } from '@/lib/colors'
import { buildSeed } from '@/lib/seed'
import { emptySnapshot, type Snapshot, type Task, type UserSettings } from '@/lib/types'
import { counterIds } from '@/test/factories'
import { BACKUP_APP, BACKUP_VERSION, BackupError, exportBackup, parseBackup } from './backup'

const TODAY = '2026-11-06'
const NOW = new Date(2026, 10, 6, 15, 25)
const SETTINGS: UserSettings = {
  user_id: 'u-secret',
  calendar_color_by: 'priority',
  horizon_days: 30,
  show_done: false,
  available_hours: 7,
}

function seedWithUser(): Snapshot {
  const s = buildSeed(TODAY, NOW, { makeId: counterIds('old') })
  const u = <T extends { user_id: string }>(r: T): T => ({ ...r, user_id: 'u-secret' })
  return {
    companies: s.companies.map(u),
    folders: s.folders.map(u),
    tasks: s.tasks.map(u),
    links: s.links.map(u),
  }
}

/** Le stesse righe del DB come Change, per verificare che il ripristino rispetti i vincoli. */
const toChanges = (s: Snapshot): Change[] => [
  { op: 'upsert', table: 'companies', rows: s.companies },
  { op: 'upsert', table: 'folders', rows: s.folders },
  { op: 'upsert', table: 'tasks', rows: s.tasks },
  { op: 'upsert', table: 'task_links', rows: s.links },
]

describe('exportBackup', () => {
  it('writes app, version, timestamp, all tables and settings', () => {
    const data = JSON.parse(exportBackup(seedWithUser(), SETTINGS, NOW))
    expect(data).toMatchObject({ app: BACKUP_APP, version: BACKUP_VERSION, exported_at: NOW.toISOString() })
    expect(data.companies).toHaveLength(3)
    expect(data.folders).toHaveLength(6)
    expect(data.tasks).toHaveLength(14)
    expect(data.task_links).toHaveLength(3)
    expect(data.settings).toEqual({
      calendar_color_by: 'priority',
      horizon_days: 30,
      show_done: false,
      available_hours: 7,
    })
  })

  it('never includes user_id', () => {
    const json = exportBackup(seedWithUser(), SETTINGS, NOW)
    expect(json).not.toContain('user_id')
    expect(json).not.toContain('u-secret')
  })

  it('settings can be null', () => {
    expect(JSON.parse(exportBackup(emptySnapshot(), null, NOW)).settings).toBeNull()
  })
})

describe('parseBackup — round trip', () => {
  const original = seedWithUser()
  const restored = parseBackup(exportBackup(original, SETTINGS, NOW), {
    today: TODAY,
    now: NOW,
    makeId: counterIds('new'),
  })
  const oldIds = new Set([...original.companies, ...original.folders, ...original.tasks].map((r) => r.id))
  const titleOf = (s: Snapshot, id: string) => s.tasks.find((t) => t.id === id)!.title

  it('keeps every row', () => {
    expect(restored.companies).toHaveLength(original.companies.length)
    expect(restored.folders).toHaveLength(original.folders.length)
    expect(restored.tasks).toHaveLength(original.tasks.length)
    expect(restored.links).toHaveLength(original.links.length)
  })

  it('regenerates every id and clears user_id', () => {
    for (const r of [...restored.companies, ...restored.folders, ...restored.tasks]) {
      expect(oldIds.has(r.id)).toBe(false)
      expect(r.id).toMatch(/^new-\d+$/)
      expect(r.user_id).toBe('')
    }
    for (const l of restored.links) expect(l.user_id).toBe('')
    const checklistIds = restored.tasks.flatMap((t) => t.checklist.map((c) => c.id))
    const oldChecklistIds = new Set(original.tasks.flatMap((t) => t.checklist.map((c) => c.id)))
    for (const id of checklistIds) expect(oldChecklistIds.has(id)).toBe(false)
  })

  it('keeps companies (name, color, order, profile) and folders (name, company, order)', () => {
    expect(restored.companies.map((c) => [c.name, c.color, c.position, c.created_at])).toEqual(
      original.companies.map((c, i) => [c.name, c.color, i, c.created_at]),
    )
    const companyName = (s: Snapshot, id: string) => s.companies.find((c) => c.id === id)!.name
    const folderView = (s: Snapshot) =>
      s.folders.map((f) => ({
        name: f.name,
        company: companyName(s, f.company_id),
        position: f.position,
        created_at: f.created_at,
      }))
    expect(folderView(restored)).toEqual(folderView(original))
  })

  it('keeps task data, folder and company assignment, and completed_at', () => {
    const view = (s: Snapshot) =>
      s.tasks.map((t: Task) => ({
        title: t.title,
        company: s.companies.find((c) => c.id === t.company_id)!.name,
        folder: s.folders.find((f) => f.id === t.folder_id)?.name ?? null,
        notes: t.notes,
        link: t.link,
        priority: t.priority,
        status: t.status,
        due_date: t.due_date,
        due_time: t.due_time,
        estimate_min: t.estimate_min,
        checklist: t.checklist.map(({ text, done }) => ({ text, done })),
        completed_at: t.completed_at,
        created_at: t.created_at,
      }))
    expect(view(restored)).toEqual(view(original))
    for (const t of restored.tasks) expect(t.updated_at).toBe(NOW.toISOString())
  })

  it('re-points links to the new ids', () => {
    const pairs = (s: Snapshot) => s.links.map((l) => [titleOf(s, l.parent_id), titleOf(s, l.child_id)])
    expect(pairs(restored)).toEqual(pairs(original))
  })

  it('the restored data satisfies the database constraints', () => {
    const res = applyChanges(emptySnapshot(), toChanges(restored), { strict: true, userId: 'u2' })
    expect(res.snapshot.tasks).toHaveLength(14)
  })

  it('restoring twice never reuses ids', () => {
    const json = exportBackup(original, null, NOW)
    const a = parseBackup(json, { today: TODAY, now: NOW })
    const b = parseBackup(json, { today: TODAY, now: NOW })
    expect(a.companies[0]!.id).not.toBe(b.companies[0]!.id)
  })
})

describe('parseBackup — legacy prototype format', () => {
  const created = new Date(2026, 9, 1, 10, 0).getTime()
  const completedAt = new Date(2026, 10, 5, 18, 30).getTime()
  const legacy = {
    v: 1,
    companies: [
      { id: 'c1', name: 'Pasta Monesi', color: '#FFE08A' },
      { id: 'c2', name: 'Belelli', color: '#12b76a' },
    ],
    folders: [
      { id: 'fa', companyId: 'c1', name: 'Social novembre' },
      { id: 'fb', companyId: 'c1', name: 'Sito e-commerce' },
      { id: 'fc', companyId: 'c2', name: 'Campagna' },
    ],
    tasks: [
      {
        id: 'smp-call',
        title: 'Call con il cliente',
        companyId: 'c2',
        folderId: 'fc',
        priority: '3',
        status: 'todo',
        due: '2026-11-10',
        time: '15:30',
        estimate: 30,
        notes: 'note',
        link: 'https://meet.example.com',
        checklist: [
          { id: 'x1', text: 'Agenda', done: true },
          { id: 'x2', text: 'Invito', done: false },
        ],
        linked: ['smp-l1', 'smp-l2'],
        created,
      },
      {
        id: 'smp-l1',
        title: 'Slide',
        companyId: 'c2',
        folderId: 'fc',
        priority: 'urgente',
        status: 'doing',
        due: '2026-11-09',
      },
      {
        id: 'smp-l2',
        title: 'Invito',
        companyId: 'c2',
        folderId: 'fc',
        priority: 'alta',
        status: 'done',
        completedAt,
        due: '2026-11-07',
      },
      {
        id: 't-media',
        title: 'Media',
        companyId: 'c1',
        folderId: 'fa',
        priority: 'media',
        status: 'review',
        due: '2026-11-08',
      },
      {
        id: 't-bassa',
        title: 'Bassa',
        companyId: 'c1',
        folderId: '',
        priority: 'bassa',
        status: 'todo',
        time: '',
      },
      {
        id: 't-p5',
        title: 'Minima',
        companyId: 'c1',
        priority: '5',
        status: 'boh',
        due: 'non una data',
        estimate: '-10',
      },
      { id: 't-done-nodate', title: 'Fatta senza data', companyId: 'c1', priority: 'xyz', status: 'done' },
    ],
  }
  const parsed = parseBackup(JSON.stringify(legacy), { today: TODAY, now: NOW, makeId: counterIds('n') })
  const byTitle = (title: string) => {
    const t = parsed.tasks.find((x) => x.title === title)
    if (!t) throw new Error(`task ${title} non trovata`)
    return t
  }
  const folderName = (id: string | null) => parsed.folders.find((f) => f.id === id)?.name ?? null

  it('reads companies (colors lowercased) and folders (companyId)', () => {
    expect(parsed.companies.map((c) => [c.name, c.color, c.position])).toEqual([
      ['Pasta Monesi', '#ffe08a', 0],
      ['Belelli', '#12b76a', 1],
    ])
    expect(
      parsed.folders.map((f) => [f.name, parsed.companies.find((c) => c.id === f.company_id)!.name]),
    ).toEqual([
      ['Social novembre', 'Pasta Monesi'],
      ['Sito e-commerce', 'Pasta Monesi'],
      ['Campagna', 'Belelli'],
    ])
    expect(parsed.folders.map((f) => f.position)).toEqual([0, 1, 2])
  })

  it('reads tasks with companyId, folderId, due, time, estimate, checklist', () => {
    const call = byTitle('Call con il cliente')
    expect(call).toMatchObject({
      priority: 3,
      status: 'todo',
      due_date: '2026-11-10',
      due_time: '15:30',
      estimate_min: 30,
      notes: 'note',
      link: 'https://meet.example.com',
      completed_at: null,
      created_at: new Date(created).toISOString(),
      updated_at: NOW.toISOString(),
    })
    expect(folderName(call.folder_id)).toBe('Campagna')
    expect(call.checklist.map(({ text, done }) => ({ text, done }))).toEqual([
      { text: 'Agenda', done: true },
      { text: 'Invito', done: false },
    ])
    expect(call.checklist.map((c) => c.id)).not.toContain('x1')
  })

  it('maps numeric and legacy named priorities', () => {
    expect(byTitle('Slide').priority).toBe(1) // urgente
    expect(byTitle('Invito').priority).toBe(2) // alta
    expect(byTitle('Media').priority).toBe(3) // media
    expect(byTitle('Bassa').priority).toBe(4) // bassa
    expect(byTitle('Minima').priority).toBe(5) // '5'
    expect(byTitle('Fatta senza data').priority).toBe(3) // sconosciuta
  })

  it('converts completedAt (ms) and falls back to now for done tasks without it', () => {
    expect(byTitle('Invito').completed_at).toBe(new Date(completedAt).toISOString())
    expect(byTitle('Fatta senza data').completed_at).toBe(NOW.toISOString())
    expect(byTitle('Slide').completed_at).toBeNull()
  })

  it('missing or invalid due → opts.today; empty time → null; invalid status → todo; negative estimate → 0', () => {
    expect(byTitle('Bassa')).toMatchObject({ due_date: TODAY, due_time: null, folder_id: null })
    expect(byTitle('Minima')).toMatchObject({
      due_date: TODAY,
      status: 'todo',
      estimate_min: 0,
      folder_id: null,
    })
    expect(byTitle('Fatta senza data').due_date).toBe(TODAY)
  })

  it('reads links from tasks[].linked', () => {
    const pairs = parsed.links.map((l) => [
      parsed.tasks.find((t) => t.id === l.parent_id)!.title,
      parsed.tasks.find((t) => t.id === l.child_id)!.title,
    ])
    expect(pairs).toEqual([
      ['Call con il cliente', 'Slide'],
      ['Call con il cliente', 'Invito'],
    ])
  })

  it('created_at falls back to now + index when missing', () => {
    expect(byTitle('Slide').created_at).toBe(new Date(NOW.getTime() + 1).toISOString())
  })

  it('the result satisfies the database constraints', () => {
    expect(() => applyChanges(emptySnapshot(), toChanges(parsed), { strict: true })).not.toThrow()
  })
})

describe('parseBackup — validation and repairs', () => {
  const opts = { today: TODAY, now: NOW, makeId: counterIds('r') }
  const parse = (data: unknown) => parseBackup(JSON.stringify(data), opts)

  it.each([
    ['invalid JSON', '{non json'],
    ['empty string', ''],
    ['null', 'null'],
    ['array', '[]'],
    ['number', '42'],
    ['empty object', '{}'],
    ['missing tasks', '{"companies": []}'],
    ['missing companies', '{"tasks": []}'],
    ['companies not an array', '{"companies": {}, "tasks": []}'],
  ])('%s → BackupError', (_name, raw) => {
    expect(() => parseBackup(raw, opts)).toThrow(BackupError)
  })

  it('empty arrays are a valid (empty) backup', () => {
    expect(parse({ companies: [], tasks: [] })).toEqual(emptySnapshot())
  })

  it('drops companies without id or name, and trims names', () => {
    const s = parse({
      companies: [
        { id: 'a', name: '  Pasta Monesi  ' },
        { id: 'b', name: '   ' },
        { name: 'Senza id' },
        'non un oggetto',
        null,
        { id: 'c', name: 'x'.repeat(200) },
      ],
      tasks: [],
    })
    expect(s.companies.map((c) => c.name)).toEqual(['Pasta Monesi', 'x'.repeat(120)])
  })

  it('drops folders and tasks of missing companies', () => {
    const s = parse({
      companies: [
        { id: 'c1', name: 'A' },
        { id: 'c-noname', name: '' },
      ],
      folders: [
        { id: 'f1', company_id: 'c1', name: 'Ok' },
        { id: 'f2', company_id: 'ghost', name: 'Orfana' },
        { id: 'f3', company_id: 'c-noname', name: 'Di azienda scartata' },
        { id: 'f4', company_id: 'c1', name: '' },
      ],
      tasks: [
        { id: 't1', company_id: 'c1', title: 'Ok' },
        { id: 't2', company_id: 'ghost', title: 'Orfana' },
        { id: 't3', companyId: 'c-noname', title: 'Di azienda scartata' },
        { id: 't4', company_id: 'c1', title: '  ' },
        { company_id: 'c1', title: 'Senza id' },
      ],
    })
    expect(s.folders.map((f) => f.name)).toEqual(['Ok'])
    expect(s.tasks.map((t) => t.title)).toEqual(['Ok'])
  })

  it('a folder of another company (or an unknown folder) becomes null', () => {
    const s = parse({
      companies: [
        { id: 'c1', name: 'A' },
        { id: 'c2', name: 'B' },
      ],
      folders: [{ id: 'f2', company_id: 'c2', name: 'Di B' }],
      tasks: [
        { id: 't1', company_id: 'c1', folder_id: 'f2', title: 'Cartella sbagliata' },
        { id: 't2', company_id: 'c1', folder_id: 'ghost', title: 'Cartella inesistente' },
        { id: 't3', company_id: 'c1', folder_id: 'c2', title: 'Id di un’azienda come cartella' },
        { id: 't4', company_id: 'c2', folder_id: 'f2', title: 'Giusta' },
      ],
    })
    expect(s.tasks.map((t) => [t.title, t.folder_id === null])).toEqual([
      ['Cartella sbagliata', true],
      ['Cartella inesistente', true],
      ['Id di un’azienda come cartella', true],
      ['Giusta', false],
    ])
  })

  it('skips cyclic, self, duplicate and dangling links', () => {
    const s = parse({
      companies: [{ id: 'c1', name: 'A' }],
      tasks: [
        { id: 'a', company_id: 'c1', title: 'A' },
        { id: 'b', company_id: 'c1', title: 'B' },
        { id: 'c', company_id: 'c1', title: 'C' },
      ],
      task_links: [
        { parent_id: 'a', child_id: 'b' },
        { parent_id: 'b', child_id: 'c' },
        { parent_id: 'c', child_id: 'a' }, // ciclo indiretto
        { parent_id: 'b', child_id: 'a' }, // ciclo diretto
        { parent_id: 'a', child_id: 'a' }, // self
        { parent_id: 'a', child_id: 'b' }, // duplicato
        { parent_id: 'a', child_id: 'ghost' },
        { parent_id: 'a', child_id: 'c' }, // diamante: ok
      ],
    })
    const title = (id: string) => s.tasks.find((t) => t.id === id)!.title
    expect(s.links.map((l) => `${title(l.parent_id)}>${title(l.child_id)}`)).toEqual(['A>B', 'B>C', 'A>C'])
  })

  it('invalid colors are replaced by unused palette colors', () => {
    const s = parse({
      companies: [
        { id: 'a', name: 'A', color: '#ffe08a' },
        { id: 'b', name: 'B', color: 'rosso' },
        { id: 'c', name: 'C' },
        { id: 'd', name: 'D', color: '#fff' },
      ],
      tasks: [],
    })
    expect(s.companies.map((c) => c.color)).toEqual([
      '#ffe08a',
      COMPANY_COLORS[1],
      COMPANY_COLORS[2],
      COMPANY_COLORS[3],
    ])
  })

  it('profiles are parsed tolerantly', () => {
    const s = parse({
      companies: [{ id: 'a', name: 'A', profile: { website: 'a.it', contacts: 'boh' } }],
      tasks: [],
    })
    expect(s.companies[0]!.profile).toMatchObject({ website: 'a.it', contacts: [] })
  })

  it('normalizes due_time with seconds and ignores invalid times', () => {
    const s = parse({
      companies: [{ id: 'c1', name: 'A' }],
      tasks: [
        {
          id: 't1',
          company_id: 'c1',
          title: 'Secondi',
          due_date: '2026-11-10T00:00:00Z',
          due_time: '09:15:00',
        },
        { id: 't2', company_id: 'c1', title: 'Ora strana', due_time: '9:15' },
      ],
    })
    expect(s.tasks.map((t) => [t.due_date, t.due_time])).toEqual([
      ['2026-11-10', '09:15'],
      [TODAY, null],
    ])
  })

  it('folder positions: explicit values are kept (also 0), missing ones use the index', () => {
    const s = parse({
      companies: [
        { id: 'c1', name: 'A' },
        { id: 'c2', name: 'B' },
      ],
      folders: [
        { id: 'f1', company_id: 'c1', name: 'A0', position: 0 },
        { id: 'f2', company_id: 'c1', name: 'A1', position: 1 },
        { id: 'f3', company_id: 'c2', name: 'B0', position: 0 },
        { id: 'f4', company_id: 'c2', name: 'B1', position: 1 },
        { id: 'f5', company_id: 'c2', name: 'Senza posizione' },
      ],
      tasks: [],
    })
    expect(s.folders.map((f) => [f.name, f.position])).toEqual([
      ['A0', 0],
      ['A1', 1],
      ['B0', 0],
      ['B1', 1],
      ['Senza posizione', 4],
    ])
  })
})
