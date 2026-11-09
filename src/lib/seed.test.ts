import { applyChanges, type Change } from '@/data/changes'
import { counterIds } from '@/test/factories'
import { emptyProfile } from './profile'
import { buildSeed } from './seed'
import { emptySnapshot } from './types'

const TODAY = '2026-11-06'
const NOW = new Date(2026, 10, 6, 15, 25)
const HOUR = 36e5

describe('buildSeed', () => {
  const seed = buildSeed(TODAY, NOW, { basePosition: 4, makeId: counterIds('seed') })
  const byTitle = (title: string) => {
    const t = seed.tasks.find((x) => x.title === title)
    if (!t) throw new Error(`task ${title} non trovata`)
    return t
  }

  it('creates the 3 sample companies with their colors and positions from basePosition', () => {
    expect(seed.companies.map((c) => [c.name, c.color, c.position])).toEqual([
      ['Pasta Monesi', '#ffe08a', 4],
      ['Belelli', '#12b76a', 5],
      ['Hybrix', '#1d3fae', 6],
    ])
    for (const c of seed.companies) expect(c.profile).toEqual(emptyProfile())
  })

  it('basePosition defaults to 0', () => {
    expect(buildSeed(TODAY, NOW).companies.map((c) => c.position)).toEqual([0, 1, 2])
  })

  it('creates 2 folders per company', () => {
    expect(seed.folders).toHaveLength(6)
    for (const c of seed.companies) {
      const fs = seed.folders.filter((f) => f.company_id === c.id)
      expect(fs.map((f) => f.position)).toEqual([0, 1])
    }
    expect(seed.folders.map((f) => f.name)).toEqual([
      'Social novembre',
      'Sito e-commerce',
      'Campagna',
      'Video',
      'Lancio',
      'Materiale stampa',
    ])
  })

  it('creates 14 tasks, each in a folder of its own company', () => {
    expect(seed.tasks).toHaveLength(14)
    const folderCompany = new Map(seed.folders.map((f) => [f.id, f.company_id]))
    for (const t of seed.tasks) {
      expect(t.folder_id).not.toBeNull()
      expect(folderCompany.get(t.folder_id!)).toBe(t.company_id)
    }
  })

  it('uses makeId for every id (unique)', () => {
    const ids = [
      ...seed.companies.map((c) => c.id),
      ...seed.folders.map((f) => f.id),
      ...seed.tasks.map((t) => t.id),
      ...seed.tasks.flatMap((t) => t.checklist.map((c) => c.id)),
    ]
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^seed-\d+$/)
  })

  it('defaults to random UUIDs', () => {
    expect(buildSeed(TODAY, NOW).companies[0]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
  })

  it('leaves user_id empty everywhere', () => {
    const rows = [...seed.companies, ...seed.folders, ...seed.tasks, ...seed.links]
    for (const r of rows) expect(r.user_id).toBe('')
  })

  it('dates are relative to today', () => {
    expect(byTitle('Piano editoriale settimana prossima').due_date).toBe(TODAY)
    expect(byTitle('Aggiornare spedizioni festive nel footer').due_date).toBe('2026-11-05')
    expect(byTitle('Locandina evento')).toMatchObject({ due_date: '2026-11-07', due_time: '12:00' })
    expect(byTitle('Comunicato stampa').due_date).toBe('2026-11-18')
    const other = buildSeed('2027-01-30', NOW)
    expect(other.tasks.find((t) => t.title === 'Comunicato stampa')!.due_date).toBe('2027-02-11')
  })

  it('"Call con il cliente per promo gennaio" is P3, +4 days at 15:30 with 3 linked children, one done', () => {
    const call = byTitle('Call con il cliente per promo gennaio')
    expect(call).toMatchObject({ priority: 3, due_date: '2026-11-10', due_time: '15:30', status: 'todo' })
    expect(seed.links).toHaveLength(3)
    expect(seed.links.every((l) => l.parent_id === call.id)).toBe(true)
    const children = seed.links.map((l) => seed.tasks.find((t) => t.id === l.child_id)!)
    expect(children.map((t) => t.title).sort()).toEqual([
      'Inviare invito Google Meet',
      'Preparare slide della proposta promo',
      'Raccogliere loghi partner in alta risoluzione',
    ])
    const done = children.filter((t) => t.status === 'done')
    expect(done.map((t) => t.title)).toEqual(['Inviare invito Google Meet'])
  })

  it('done tasks have completed_at, open ones do not', () => {
    for (const t of seed.tasks) {
      if (t.status === 'done') expect(t.completed_at).toEqual(expect.any(String))
      else expect(t.completed_at).toBeNull()
    }
    expect(seed.tasks.filter((t) => t.status === 'done')).toHaveLength(2)
    expect(byTitle('Inviare invito Google Meet').completed_at).toBe(
      new Date(NOW.getTime() - HOUR).toISOString(),
    )
    expect(byTitle('Post annuncio lancio').completed_at).toBe(
      new Date(NOW.getTime() - 3 * 24 * HOUR + 5 * HOUR).toISOString(),
    )
  })

  it('created_at timestamps are unique and increasing', () => {
    const stamps = [...seed.companies, ...seed.folders].map((r) => r.created_at)
    const sorted = [...stamps].sort()
    expect(stamps).toEqual(sorted)
    expect(new Set(stamps).size).toBe(stamps.length)
    expect(new Set(seed.tasks.map((t) => t.created_at)).size).toBe(14)
    expect(seed.companies[0]!.created_at).toBe(NOW.toISOString())
  })

  it('satisfies the database constraints (strict apply)', () => {
    const changes: Change[] = [
      { op: 'upsert', table: 'companies', rows: seed.companies },
      { op: 'upsert', table: 'folders', rows: seed.folders },
      { op: 'upsert', table: 'tasks', rows: seed.tasks },
      { op: 'upsert', table: 'task_links', rows: seed.links },
    ]
    const res = applyChanges(emptySnapshot(), changes, { strict: true, userId: 'u1', now: NOW.toISOString() })
    expect(res.snapshot.tasks).toHaveLength(14)
    expect(res.snapshot.links).toHaveLength(3)
    // completed_at già coerente: non viene riscritto
    for (const t of res.snapshot.tasks) {
      expect(t.completed_at).toBe(seed.tasks.find((s) => s.id === t.id)!.completed_at)
    }
  })
})
